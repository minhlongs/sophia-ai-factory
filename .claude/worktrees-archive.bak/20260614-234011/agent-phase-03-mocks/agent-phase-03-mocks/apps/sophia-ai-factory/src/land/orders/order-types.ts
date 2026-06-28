/**
 * TypeScript types for the orders timeline feature.
 *
 * @module lib/orders/order-types
 */

export type PurchaseStatusType = 'pending' | 'paid' | 'refunded' | 'failed'

export type VideoStatusType =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'failed_permanent'

export interface OrderTimelineRow {
  purchaseId: string
  sku: string
  status: PurchaseStatusType
  paidAt: number | null
  creditsRemaining: number
  videoId: string | null
  videoStatus: VideoStatusType | null
  attemptCount: number
  lastAttemptAt: number | null
  videoUrl: string | null
  estimatedReadyAt: number | null
  /** F10: 1 if video access revoked due to refund, 0 otherwise */
  accessRevoked: number
}
