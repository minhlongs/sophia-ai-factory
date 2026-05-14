'use client'

/**
 * PaymentStatusPoller — polls /api/checkout/status every 4s until resolved.
 * Max 15 attempts (~60s), then shows "still processing" message.
 * Used on payment-success page when order status is still pending.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isVi = locale?.startsWith('vi')

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/checkout/status?orderId=${encodeURIComponent(orderId)}`)
      if (!res.ok) return

      const data = await res.json() as StatusResponse

      if (data.status === 'completed') {
        if (intervalRef.current) clearInterval(intervalRef.current)
        window.location.reload()
        return
      }

      if (data.status === 'failed' || data.status === 'expired') {
        if (intervalRef.current) clearInterval(intervalRef.current)
        router.push(`/${locale}/checkout/failure?orderId=${encodeURIComponent(orderId)}`)
        return
      }
    } catch { /* network error, try again next tick */ }
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

  if (timedOut) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
        <p className="font-semibold text-amber-300 mb-2">
          {isVi ? 'Vẫn đang xử lý...' : 'Still processing...'}
        </p>
        <p className="text-sm text-zinc-400">
          {isVi
            ? 'Blockchain đang xác nhận giao dịch của bạn. Chúng tôi sẽ gửi email khi hoàn tất.'
            : 'The blockchain is confirming your transaction. We\'ll email you when it\'s done.'}
        </p>
        <a
          href="mailto:support@mekongmind.com"
          className="mt-4 inline-block text-sm text-violet-400 hover:text-violet-300 underline"
        >
          {isVi ? 'Liên hệ hỗ trợ' : 'Contact support'}
        </a>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.07] p-6 text-center">
      <div className="flex items-center justify-center gap-2 mb-3">
        <Loader2 className="h-5 w-5 text-blue-400 motion-safe:animate-spin" />
        <p className="font-semibold text-blue-300">
          {isVi ? 'Đang xác nhận thanh toán...' : 'Confirming payment...'}
        </p>
      </div>
      <p className="text-sm text-zinc-400">
        {isVi
          ? `Crypto mất 2-5 phút để xác nhận. Đang kiểm tra... (${attempt}/${MAX_ATTEMPTS})`
          : `Crypto confirmations take 2-5 min. Checking... (${attempt}/${MAX_ATTEMPTS})`}
      </p>
    </div>
  )
}
