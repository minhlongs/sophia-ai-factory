'use client'

/**
 * PaymentStatusPoller — polls /api/checkout/status every 4s until resolved.
 * Max 15 attempts (~60s), then shows "still processing" message.
 * Used on payment-success page when order status is still pending.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Loader2 } from 'lucide-react'
import { Link } from '@/navigation'

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

  const isVi = locale?.startsWith('vi')

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
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <CheckCircle className="h-5 w-5 text-emerald-400" />
          <p className="font-semibold text-emerald-300">
            {isVi ? 'Giao dịch đã hoàn tất!' : 'Payment confirmed!'}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {isVi
            ? 'Thanh toán của bạn đã được xác nhận. Vui lòng kiểm tra email để nhận hóa đơn.'
            : 'Your payment has been confirmed. Please check your email for a receipt.'}
        </p>
        <div className="mt-4">
          <Link
            href={`/${locale}/dashboard`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-6 py-2.5 text-sm font-semibold text-primary-foreground transition hover:from-primary/90 hover:to-accent/90"
          >
            {isVi ? 'Vào bảng điều khiển' : 'Go to dashboard'}
          </Link>
        </div>
      </div>
    )
  }

  if (timedOut) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
        <p className="font-semibold text-amber-300 mb-2">
          {isVi ? 'Vẫn đang xử lý...' : 'Still processing...'}
        </p>
        <p className="text-sm text-muted-foreground">
          {isVi
            ? 'Blockchain đang xác nhận giao dịch của bạn. Chúng tôi sẽ gửi email khi hoàn tất.'
            : 'The blockchain is confirming your transaction. We\'ll email you when it\'s done.'}
        </p>
        <a
          href="mailto:support@mekongmind.com"
          className="mt-4 inline-block text-sm text-primary hover:text-primary/80 underline"
        >
          {isVi ? 'Liên hệ hỗ trợ' : 'Contact support'}
        </a>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-6 text-center">
      <div className="flex items-center justify-center gap-2 mb-3">
        <Loader2 className="h-5 w-5 text-primary motion-safe:animate-spin" />
        <p className="font-semibold text-foreground">
          {isVi ? 'Đang xác nhận thanh toán...' : 'Confirming payment...'}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        {isVi
          ? `Crypto mất 2-5 phút để xác nhận. Đang kiểm tra... (${attempt}/${MAX_ATTEMPTS})`
          : `Crypto confirmations take 2-5 min. Checking... (${attempt}/${MAX_ATTEMPTS})`}
      </p>
    </div>
  )
}
