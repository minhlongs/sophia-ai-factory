'use client'

/**
 * PaymentStatusPoller — polls /api/checkout/status every 4s until resolved.
 * Max 15 attempts (~60s), then shows "still processing" message.
 * Used on payment-success page when order status is still pending.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  PaymentConfirmedCard,
  PaymentTimedOutCard,
  PaymentPollingCard,
} from './payment-status-poller-views'

interface PaymentStatusPollerProps {
  orderId: string
  locale: string
}

interface StatusResponse {
  status: 'pending' | 'completed' | 'failed' | 'expired'
  tier?: string
  period?: string
  paymentId?: string
  completedAt?: string
}

const MAX_ATTEMPTS = 15
const POLL_INTERVAL_MS = 4000

export function PaymentStatusPoller({ orderId, locale }: PaymentStatusPollerProps) {
  const router = useRouter()
  const [attempt, setAttempt] = useState(0)
  const [timedOut, setTimedOut] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollingRef = useRef(false)

  const isVi = Boolean(locale?.startsWith('vi'))

  const pollStatus = useCallback(async () => {
    if (pollingRef.current) return
    pollingRef.current = true
    try {
      const res = await fetch(`/api/checkout/status?orderId=${encodeURIComponent(orderId)}`)
      if (!res.ok) return

      const data = await res.json() as StatusResponse

      if (data.status === 'completed') {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setIsComplete(true)
        return
      }

      if (data.status === 'failed' || data.status === 'expired') {
        if (intervalRef.current) clearInterval(intervalRef.current)
        router.push(`/${locale}/checkout/failure?orderId=${encodeURIComponent(orderId)}`)
        return
      }
    } catch { /* network error, try again next tick */ }
    finally {
      pollingRef.current = false
    }
  }, [orderId, locale, router])

  useEffect(() => {
    let currentAttempt = 0

    intervalRef.current = setInterval(async () => {
      currentAttempt += 1
      setAttempt(currentAttempt)

      if (currentAttempt >= MAX_ATTEMPTS) {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setTimedOut(true)
        return
      }

      await pollStatus()
    }, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [pollStatus])

  if (isComplete) {
    return <PaymentConfirmedCard isVi={isVi} locale={locale} />
  }

  if (timedOut) {
    return <PaymentTimedOutCard isVi={isVi} />
  }

  return <PaymentPollingCard isVi={isVi} attempt={attempt} maxAttempts={MAX_ATTEMPTS} />
}
