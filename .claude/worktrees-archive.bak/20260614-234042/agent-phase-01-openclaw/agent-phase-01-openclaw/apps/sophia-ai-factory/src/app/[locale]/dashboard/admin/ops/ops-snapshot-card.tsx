'use client'

/**
 * OpsSnapshotCard — client component for the admin ops dashboard.
 *
 * Polls /api/admin/ops/snapshot every 30s via SWR.
 * Renders 5 health cards: version, queue, cron runs, reconcile, HeyGen/circuit-breaker.
 * Color-codes each card (green/yellow/red) based on health signals.
 *
 * @module app/[locale]/dashboard/admin/ops/ops-snapshot-card
 */

import useSWR from 'swr'
import { useState } from 'react'
import type { OpsSnapshotResponse } from '@/app/api/admin/ops/snapshot/route'

const REFRESH_INTERVAL = 30_000

async function fetchSnapshot(url: string): Promise<OpsSnapshotResponse> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Snapshot fetch failed: ${res.status}`)
  return res.json() as Promise<OpsSnapshotResponse>
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${ok ? 'bg-green-500' : 'bg-red-500'}`}
      aria-label={ok ? 'healthy' : 'unhealthy'}
    />
  )
}

function Card({
  title,
  titleVi,
  health,
  children,
}: {
  title: string
  titleVi: string
  health: 'green' | 'yellow' | 'red'
  children: React.ReactNode
}) {
  const border = health === 'green' ? 'border-green-800' : health === 'yellow' ? 'border-yellow-700' : 'border-red-800'
  const bg = health === 'green' ? 'bg-green-950/30' : health === 'yellow' ? 'bg-yellow-950/30' : 'bg-red-950/30'

  return (
    <div className={`rounded-xl border ${border} ${bg} p-4 space-y-2`}>
      <h3 className="font-semibold text-muted-foreground-200 text-sm">
        {title} <span className="text-muted-foreground-500 font-normal">/ {titleVi}</span>
      </h3>
      {children}
    </div>
  )
}

interface Props {
  locale: string
}

export function OpsSnapshotCard({ locale }: Props) {
  const isVi = locale.startsWith('vi')
  const [expandedCron, setExpandedCron] = useState<string | null>(null)

  const { data, error, isLoading, mutate } = useSWR(
    '/api/admin/ops/snapshot',
    fetchSnapshot,
    { refreshInterval: REFRESH_INTERVAL },
  )

  if (isLoading) {
    return (
      <div className="text-muted-foreground-400 text-sm motion-safe:animate-pulse py-8 text-center">
        {isVi ? 'Đang tải dữ liệu vận hành...' : 'Loading ops data...'}
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="text-red-400 text-sm py-4">
        {isVi ? 'Không tải được snapshot. ' : 'Failed to load snapshot. '}
        <button onClick={() => mutate()} className="underline">
          {isVi ? 'Thử lại' : 'Retry'}
        </button>
      </div>
    )
  }

  // ── Card 1: Version ────────────────────────────────────────────────────────
  const versionHealth: 'green' | 'yellow' | 'red' =
    data.version.sha === 'unknown' ? 'yellow' : 'green'

  // ── Card 2: Queue ──────────────────────────────────────────────────────────
  const queueHealth: 'green' | 'yellow' | 'red' =
    data.activeQueue.total > 50 ? 'red' : data.activeQueue.total > 10 ? 'yellow' : 'green'

  // ── Card 3: Reconcile ──────────────────────────────────────────────────────
  const reconcileHealth: 'green' | 'yellow' | 'red' =
    data.reconcile24h.mismatch > 5 || data.reconcile24h.failedPermanent > 0
      ? 'red'
      : data.reconcile24h.mismatch > 0
        ? 'yellow'
        : 'green'

  // ── Card 4: Cron Runs ──────────────────────────────────────────────────────
  const failedCrons = data.cronRuns.filter((c) => c.last_status === 'failure')
  const cronHealth: 'green' | 'yellow' | 'red' =
    failedCrons.length > 2 ? 'red' : failedCrons.length > 0 ? 'yellow' : 'green'

  // ── Card 5: HeyGen + Circuit Breaker ──────────────────────────────────────
  const hgOk = data.heygenHealth.healthy && data.circuitBreaker.state === 'closed'
  const hgHealth: 'green' | 'yellow' | 'red' =
    data.circuitBreaker.state === 'open'
      ? 'red'
      : data.circuitBreaker.state === 'half-open' || !data.heygenHealth.healthy
        ? 'yellow'
        : 'green'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground-500">
          {isVi ? 'Cập nhật lúc' : 'Updated at'}: {new Date(data.generatedAt).toLocaleTimeString()}
        </p>
        <button
          onClick={() => mutate()}
          className="text-xs text-muted-foreground-400 hover:text-muted-foreground-200 transition-colors"
        >
          {isVi ? 'Làm mới' : 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">

        {/* Version */}
        <Card title="Deployment" titleVi="Phiên bản" health={versionHealth}>
          <p className="text-xs text-muted-foreground-300">
            SHA: <code className="font-mono">{data.version.sha.slice(0, 8)}</code>
          </p>
          <p className="text-xs text-muted-foreground-400">
            {isVi ? 'Triển khai' : 'Deployed'}: {new Date(data.version.deployedAt).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground-500">OpenNext: {data.version.opennextVersion}</p>
        </Card>

        {/* Queue */}
        <Card title="Queue" titleVi="Hàng đợi" health={queueHealth}>
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-muted-foreground-400 text-xs">{isVi ? 'Chờ' : 'Queued'}</span>
              <p className={`font-bold ${data.activeQueue.queued > 20 ? 'text-red-400' : 'text-muted-foreground-200'}`}>
                {data.activeQueue.queued}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground-400 text-xs">{isVi ? 'Đang xử lý' : 'Processing'}</span>
              <p className="font-bold text-muted-foreground-200">{data.activeQueue.processing}</p>
            </div>
            <div>
              <span className="text-muted-foreground-400 text-xs">{isVi ? 'Tổng' : 'Total'}</span>
              <p className="font-bold text-muted-foreground-200">{data.activeQueue.total}</p>
            </div>
          </div>
        </Card>

        {/* Reconcile */}
        <Card title="Reconcile 24h" titleVi="Đối soát 24h" health={reconcileHealth}>
          <div className="text-xs text-muted-foreground-300 space-y-1">
            <p>
              <StatusDot ok={true} />
              {isVi ? 'Đã trả' : 'Paid'}: <strong>{data.reconcile24h.paid}</strong>
            </p>
            <p>
              <StatusDot ok={data.reconcile24h.delivered === data.reconcile24h.paid} />
              {isVi ? 'Đã giao' : 'Delivered'}: <strong>{data.reconcile24h.delivered}</strong>
            </p>
            <p>
              <StatusDot ok={data.reconcile24h.mismatch === 0} />
              {isVi ? 'Chênh lệch' : 'Mismatch'}: <strong className={data.reconcile24h.mismatch > 0 ? 'text-red-400' : ''}>{data.reconcile24h.mismatch}</strong>
            </p>
            <p>
              <StatusDot ok={data.reconcile24h.failedPermanent === 0} />
              {isVi ? 'Thất bại vĩnh viễn' : 'Perm. failed'}: <strong className={data.reconcile24h.failedPermanent > 0 ? 'text-red-400' : ''}>{data.reconcile24h.failedPermanent}</strong>
            </p>
          </div>
        </Card>

        {/* Cron Runs */}
        <Card title="Cron Runs" titleVi="Lịch cron" health={cronHealth}>
          {data.cronRuns.length === 0 ? (
            <p className="text-xs text-muted-foreground-500">{isVi ? 'Chưa có lịch sử' : 'No cron history'}</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {data.cronRuns.map((run) => (
                <div key={run.cron_name} className="text-xs">
                  <button
                    className="flex items-center gap-1 w-full text-left hover:text-muted-foreground-100 transition-colors"
                    onClick={() =>
                      setExpandedCron(expandedCron === run.cron_name ? null : run.cron_name)
                    }
                  >
                    <StatusDot ok={run.last_status !== 'failure'} />
                    <span className="font-mono text-muted-foreground-300 truncate flex-1">{run.cron_name}</span>
                    <span className="text-muted-foreground-500 shrink-0">#{run.run_count}</span>
                  </button>
                  {expandedCron === run.cron_name && run.last_error && (
                    <p className="ml-4 mt-1 text-red-400 break-all">{run.last_error}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* HeyGen + Circuit Breaker */}
        <Card title="HeyGen" titleVi="Trạng thái HeyGen" health={hgHealth}>
          <div className="text-xs space-y-1">
            <p className="flex items-center">
              <StatusDot ok={data.heygenHealth.healthy} />
              {isVi ? 'Nhà cung cấp' : 'Provider'}: <strong className="ml-1">{data.heygenHealth.providerStatus}</strong>
            </p>
            <p className="flex items-center">
              <StatusDot ok={hgOk} />
              {isVi ? 'Cầu dao' : 'Circuit'}: <strong className={`ml-1 ${data.circuitBreaker.state === 'open' ? 'text-red-400' : data.circuitBreaker.state === 'half-open' ? 'text-yellow-400' : 'text-green-400'}`}>{data.circuitBreaker.state}</strong>
            </p>
            <p className="text-muted-foreground-500">
              {isVi ? 'Lỗi gần đây' : 'Recent failures'}: {data.circuitBreaker.recentFailures}
              {' / '}
              {isVi ? 'Thành công' : 'Successes'}: {data.circuitBreaker.recentSuccesses}
            </p>
            {data.circuitBreaker.openedAt && (
              <p className="text-muted-foreground-500">
                {isVi ? 'Mở lúc' : 'Opened at'}: {new Date(data.circuitBreaker.openedAt).toLocaleTimeString()}
              </p>
            )}
          </div>
        </Card>

      </div>
    </div>
  )
}
