'use client'

/**
 * E2E Smoke test admin UI — Hook E.
 * Dispatches a signed synthetic IPN → tracks order status until completed.
 * Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/admin/e2e-smoke/e2e-smoke-client
 */

import Link from 'next/link'
import { useState, useRef } from 'react'

interface Props { locale: string }

interface SyntheticResult {
  success: boolean
  payment_id?: string
  dispatched_at?: string
  sku?: { id: string; priceUsd: number; credits: number }
  target_user_id?: string
  watch_url?: string
  error?: string
  webhook_status?: number
  webhook_body?: string
}

interface OrderRow {
  id: string
  status: string
  video_url?: string
  created_at: number
}

interface OrdersResponse {
  orders?: OrderRow[]
}

type Phase = 'idle' | 'dispatching' | 'polling' | 'completed' | 'failed'

interface Timeline {
  phase: string
  ts: string
  detail?: string
}

export function E2ESmokeClient({ locale }: Props) {
  const isVi = locale.startsWith('vi')
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<SyntheticResult | null>(null)
  const [timeline, setTimeline] = useState<Timeline[]>([])
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function addEvent(label: string, detail?: string) {
    setTimeline((prev) => [...prev, { phase: label, ts: new Date().toISOString(), detail }])
  }

  function stopTimers() {
    if (timerRef.current) clearInterval(timerRef.current)
    if (pollRef.current) clearInterval(pollRef.current)
  }

  async function runSmoke() {
    stopTimers()
    setPhase('dispatching')
    setResult(null)
    setTimeline([])
    setElapsed(0)

    const start = Date.now()
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    addEvent(isVi ? 'Gửi IPN giả' : 'Dispatching synthetic IPN')

    let res: SyntheticResult
    try {
      const r = await fetch('/api/admin/synthetic-ipn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skuId: 'STARTER_BUNDLE' }),
      })
      res = await r.json() as SyntheticResult
    } catch (err) {
      stopTimers()
      setPhase('failed')
      setResult({ success: false, error: err instanceof Error ? err.message : 'Fetch error' })
      return
    }

    setResult(res)

    if (!res.success) {
      stopTimers()
      setPhase('failed')
      addEvent(isVi ? 'Thất bại' : 'Failed', res.error ?? `webhook HTTP ${res.webhook_status}`)
      return
    }

    addEvent(isVi ? 'IPN đã gửi' : 'IPN dispatched', `payment_id: ${res.payment_id}`)
    setPhase('polling')

    let polls = 0
    const MAX_POLLS = 60 // 10 min at 10s intervals
    pollRef.current = setInterval(async () => {
      polls++
      if (polls > MAX_POLLS) {
        stopTimers()
        setPhase('failed')
        addEvent(isVi ? 'Hết thời gian chờ' : 'Timed out', '10 min elapsed without completion')
        return
      }

      try {
        const r = await fetch('/api/orders')
        const data = await r.json() as OrdersResponse
        const orders = data.orders ?? []
        // Find a recent order created after dispatch
        const dispatchedMs = new Date(res.dispatched_at ?? Date.now()).getTime()
        const match = orders.find((o) => o.created_at * 1000 >= dispatchedMs - 5000)

        if (match?.status === 'completed') {
          stopTimers()
          setPhase('completed')
          addEvent(isVi ? 'Hoàn thành' : 'Completed', `orderId: ${match.id} | status: ${match.status}`)
        } else if (match) {
          addEvent(isVi ? 'Đang xử lý' : 'In progress', `status: ${match.status}`)
        }
      } catch {
        // network error — keep polling
      }
    }, 10_000)
  }

  function reset() {
    stopTimers()
    setPhase('idle')
    setResult(null)
    setTimeline([])
    setElapsed(0)
  }

  const statusColor = {
    idle: 'text-muted-foreground-400',
    dispatching: 'text-yellow-400',
    polling: 'text-blue-400',
    completed: 'text-emerald-400',
    failed: 'text-red-400',
  }[phase]

  const statusLabel = {
    idle: isVi ? 'Sẵn sàng' : 'Ready',
    dispatching: isVi ? 'Đang gửi IPN...' : 'Dispatching IPN...',
    polling: isVi ? 'Đang theo dõi đơn hàng...' : 'Polling orders...',
    completed: isVi ? 'Hoàn thành!' : 'Completed!',
    failed: isVi ? 'Thất bại' : 'Failed',
  }[phase]

  return (
    <div className="space-y-6">
      {/* Status + controls */}
      <div className="rounded-xl border border-border-800 bg-muted-900/50 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className={`text-lg font-semibold ${statusColor}`}>{statusLabel}</span>
            {phase !== 'idle' && (
              <span className="ml-3 text-xs text-muted-foreground-500">{elapsed}s</span>
            )}
          </div>
          <div className="flex gap-2">
            {phase === 'idle' || phase === 'completed' || phase === 'failed' ? (
              <button
                onClick={runSmoke}
                className="px-4 py-2 bg-primary-700 hover:bg-primary-600 text-white text-sm rounded-lg font-medium transition-colors"
              >
                {isVi ? 'Chạy kiểm tra E2E' : 'Run E2E Smoke Test'}
              </button>
            ) : null}
            {phase !== 'idle' && (
              <button
                onClick={reset}
                className="px-4 py-2 bg-muted-700 hover:bg-muted-600 text-white text-sm rounded-lg font-medium transition-colors"
              >
                {isVi ? 'Đặt lại' : 'Reset'}
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground-500">
          {isVi
            ? 'Gửi IPN NOWPayments giả (STARTER_BUNDLE $49) qua handler webhook thật. Không tốn tiền thật.'
            : 'Injects a signed synthetic NOWPayments IPN (STARTER_BUNDLE $49) through the real webhook handler. No real money spent.'}
        </p>

        {result?.success && (
          <div className="rounded-lg bg-muted-800 p-3 text-xs text-muted-foreground-300 space-y-1">
            <div><span className="text-muted-foreground-500">Payment ID:</span> {result.payment_id}</div>
            <div><span className="text-muted-foreground-500">SKU:</span> {result.sku?.id} — ${result.sku?.priceUsd} / {result.sku?.credits} credits</div>
            <div><span className="text-muted-foreground-500">Target user:</span> {result.target_user_id}</div>
          </div>
        )}

        {result && !result.success && (
          <div className="rounded-lg border border-red-800 bg-red-950/30 p-3 text-xs text-red-300">
            {result.error ?? `Webhook HTTP ${result.webhook_status}: ${result.webhook_body}`}
          </div>
        )}
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="rounded-xl border border-border-800 bg-muted-900/50 p-5 space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground-200">
            {isVi ? 'Dòng thời gian' : 'Timeline'}
          </h2>
          <ol className="space-y-2">
            {timeline.map((e, i) => (
              <li key={i} className="flex gap-3 text-xs">
                <span className="text-muted-foreground-600 font-mono shrink-0">{e.ts.split('T')[1]?.slice(0, 8)}</span>
                <span className="text-muted-foreground-300 font-medium shrink-0">{e.phase}</span>
                {e.detail && <span className="text-muted-foreground-500">{e.detail}</span>}
              </li>
            ))}
          </ol>
          {phase === 'completed' && (
            <Link
              href="/dashboard/orders"
              className="inline-block mt-2 text-xs text-primary-400 hover:text-primary-300 underline"
            >
              {isVi ? 'Xem đơn hàng' : 'View orders'}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
