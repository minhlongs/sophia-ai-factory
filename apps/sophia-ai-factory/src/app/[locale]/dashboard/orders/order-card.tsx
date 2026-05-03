/**
 * OrderCard — client component with SWR auto-refresh every 30s.
 * Shows purchase details + video render timeline for one order.
 * Polling only active when video is in-flight (queued|processing).
 *
 * @module app/[locale]/dashboard/orders/order-card
 */

'use client'

import useSWR from 'swr'
import { OrderTimeline } from './order-timeline'
import type { OrderTimelineRow } from '@/land/orders/order-types'

const REFRESH_INTERVAL_MS = 30_000

interface OrdersApiResponse {
  orders: OrderTimelineRow[]
}

interface VideoUrlResponse {
  url: string
  expiresIn: number
}

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<OrdersApiResponse>)
const videoUrlFetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) return null
  return r.json() as Promise<VideoUrlResponse>
})

const IN_FLIGHT_STATUSES = new Set(['queued', 'processing'])

interface OrderCardProps {
  purchaseId: string
  initialOrder: OrderTimelineRow
  locale: string
}

const SUPPORT_EMAIL = 'support@sophia.agencyos.network'

function skuLabel(sku: string): string {
  return sku
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function creditsLabel(n: number, isVi: boolean): string {
  return isVi ? `Còn ${n} credit` : `${n} credit${n !== 1 ? 's' : ''} remaining`
}

export function OrderCard({ purchaseId, initialOrder, locale }: OrderCardProps) {
  const isVi = locale.startsWith('vi')

  // Only poll when video is in-flight
  const shouldPoll = IN_FLIGHT_STATUSES.has(initialOrder.videoStatus ?? '')

  const { data } = useSWR<OrdersApiResponse>(
    '/api/orders',
    fetcher,
    { refreshInterval: shouldPoll ? REFRESH_INTERVAL_MS : 0, revalidateOnFocus: shouldPoll },
  )

  const orders = data?.orders ?? [initialOrder]
  const order = orders.find((o) => o.purchaseId === purchaseId) ?? initialOrder

  const isCompleted = order.videoStatus === 'completed'
  const isPermanentFail = order.videoStatus === 'failed_permanent'
  const isAccessRevoked = (order.accessRevoked ?? 0) === 1

  // Fetch presigned URL for completed, non-revoked videos
  const { data: videoUrlData } = useSWR<VideoUrlResponse | null>(
    isCompleted && !isAccessRevoked && order.videoId
      ? `/api/videos/${order.videoId}/url`
      : null,
    videoUrlFetcher,
    { revalidateOnFocus: false, dedupingInterval: 20 * 60 * 1000 }, // ~20min dedupe (URL TTL=30min)
  )

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-zinc-100">{skuLabel(order.sku)}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{order.purchaseId.slice(0, 12)}…</p>
        </div>
        <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-900 text-green-300">
          {creditsLabel(order.creditsRemaining, isVi)}
        </span>
      </div>

      {/* Revoked banner */}
      {isAccessRevoked && (
        <div className="rounded-lg bg-red-950 border border-red-800 px-3 py-2">
          <p className="text-xs text-red-300 font-medium">
            {isVi
              ? 'Quyền truy cập video đã bị thu hồi do hoàn tiền'
              : 'Video access revoked due to refund'}
          </p>
        </div>
      )}

      {/* Permanent failure notice */}
      {isPermanentFail && !isAccessRevoked && (
        <div className="rounded-lg bg-red-950 border border-red-800 px-4 py-3 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none" aria-hidden="true">❌</span>
            <p className="text-sm font-semibold text-red-300">
              {isVi ? 'Tạo video không thành công' : 'Video generation failed'}
            </p>
          </div>
          <p className="text-xs text-red-400">
            {isVi
              ? 'Đội hỗ trợ đã được thông báo. 1 credit miễn phí đã được cộng vào tài khoản.'
              : 'Our support team has been notified. 1 free credit has been added to your account.'}
          </p>
        </div>
      )}

      {/* Timeline */}
      <OrderTimeline order={order} locale={locale} />

      {/* Retry notice */}
      {(order.attemptCount ?? 0) > 0 && !isCompleted && !isPermanentFail && (
        <p className="text-xs text-yellow-500">
          {isVi
            ? `Đã thử ${order.attemptCount}/5 lần`
            : `Attempt ${order.attemptCount} of 5`}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        {isCompleted && !isAccessRevoked && videoUrlData?.url && (
          <a
            href={videoUrlData.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm px-4 py-2 bg-green-800 hover:bg-green-700 text-green-100 rounded-lg transition-colors"
          >
            {isVi ? 'Xem video' : 'Watch video'}
          </a>
        )}
        {isPermanentFail && !isAccessRevoked && (
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Failed Order ' + purchaseId)}`}
            className="inline-block text-sm px-4 py-2 bg-red-900 hover:bg-red-800 text-red-100 rounded-lg transition-colors"
          >
            {isVi ? 'Liên hệ hỗ trợ' : 'Contact support'}
          </a>
        )}
      </div>
    </div>
  )
}
