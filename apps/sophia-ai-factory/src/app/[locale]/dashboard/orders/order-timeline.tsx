/**
 * OrderTimeline — pure presentational component showing purchase/render steps.
 * Paid → Queued → Rendering → Ready (or Failed).
 * Uses <ol> with aria-current for accessibility.
 *
 * @module app/[locale]/dashboard/orders/order-timeline
 */

'use client'

import type { OrderTimelineRow } from '@/lib/orders/order-types'

interface Step {
  key: string
  labelVi: string
  labelEn: string
  active: boolean
  done: boolean
  timestamp: number | null
  failed?: boolean
}

interface OrderTimelineProps {
  order: OrderTimelineRow
  locale: string
}

function formatTime(epochSec: number | null, locale: string): string {
  if (!epochSec) return ''
  return new Date(epochSec * 1000).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function buildSteps(order: OrderTimelineRow): Step[] {
  const isPermanentFail = order.videoStatus === 'failed_permanent'
  const isCompleted = order.videoStatus === 'completed'
  const isRendering = order.videoStatus === 'processing'
  const isQueued = order.videoStatus === 'queued'

  return [
    {
      key: 'paid',
      labelVi: 'Đã thanh toán',
      labelEn: 'Payment received',
      done: order.status === 'paid' || order.status === 'refunded',
      active: order.status === 'pending',
      timestamp: order.paidAt,
    },
    {
      key: 'queued',
      labelVi: 'Đã xếp hàng',
      labelEn: 'Queued for rendering',
      done: isRendering || isCompleted || isPermanentFail,
      active: isQueued,
      timestamp: null,
    },
    {
      key: 'rendering',
      labelVi: 'Đang tạo video',
      labelEn: 'Rendering video',
      done: isCompleted,
      active: isRendering,
      timestamp: null,
      failed: isPermanentFail,
    },
    {
      key: 'ready',
      labelVi: isCompleted ? 'Video sẵn sàng' : isPermanentFail ? 'Tạo thất bại' : 'Chờ hoàn thành',
      labelEn: isCompleted ? 'Ready' : isPermanentFail ? 'Failed' : 'Pending completion',
      done: isCompleted,
      active: false,
      timestamp: null,
      failed: isPermanentFail,
    },
  ]
}

export function OrderTimeline({ order, locale }: OrderTimelineProps) {
  const isVi = locale.startsWith('vi')
  const steps = buildSteps(order)

  return (
    <ol aria-label={isVi ? 'Trạng thái đơn hàng' : 'Order status'} className="flex flex-col gap-2">
      {steps.map((step, idx) => {
        const isActive = step.active && !step.done
        const isCurrent = isActive
        const label = isVi ? step.labelVi : step.labelEn

        return (
          <li
            key={step.key}
            aria-current={isCurrent ? 'step' : undefined}
            className="flex items-start gap-3"
          >
            <div className="flex flex-col items-center">
              <div
                className={[
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                  step.failed
                    ? 'bg-red-900 text-red-300 border border-red-700'
                    : step.done
                    ? 'bg-green-800 text-green-300 border border-green-600'
                    : isCurrent
                    ? 'bg-yellow-800 text-yellow-300 border border-yellow-600 animate-pulse'
                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700',
                ].join(' ')}
              >
                {step.done && !step.failed ? '✓' : step.failed ? '✗' : idx + 1}
              </div>
              {idx < steps.length - 1 && (
                <div className="w-px h-4 bg-zinc-700 mt-1" />
              )}
            </div>
            <div className="pt-0.5">
              <span className={[
                'text-sm',
                step.failed ? 'text-red-400' : step.done ? 'text-green-400' : isCurrent ? 'text-yellow-300' : 'text-zinc-500',
              ].join(' ')}>
                {label}
              </span>
              {step.timestamp && (
                <span className="text-xs text-zinc-500 ml-2">{formatTime(step.timestamp, locale)}</span>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
