/**
 * DB query layer for the customer orders timeline page.
 * Joins user_purchases with videos on purchase_id.
 * Security: always filters by authenticated userId — never trusts client input.
 *
 * @module lib/orders/order-query
 */

import { getD1 } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import type { OrderTimelineRow, VideoStatusType, PurchaseStatusType } from './order-types'

/** Estimated render time in seconds (8 minutes for HeyGen) */
const ESTIMATED_RENDER_SEC = 8 * 60

interface RawOrderRow {
  purchase_id: string
  sku: string
  purchase_status: string
  paid_at: number | null
  credits_remaining: number
  video_id: string | null
  video_status: string | null
  attempt_count: number | null
  last_attempt_at: number | null
  video_url: string | null
  access_revoked: number | null
}

function toOrderTimelineRow(raw: RawOrderRow): OrderTimelineRow {
  return {
    purchaseId: raw.purchase_id,
    sku: raw.sku,
    status: (raw.purchase_status ?? 'pending') as PurchaseStatusType,
    paidAt: raw.paid_at ?? null,
    creditsRemaining: raw.credits_remaining ?? 0,
    videoId: raw.video_id ?? null,
    videoStatus: (raw.video_status as VideoStatusType) ?? null,
    attemptCount: raw.attempt_count ?? 0,
    lastAttemptAt: raw.last_attempt_at ?? null,
    videoUrl: raw.video_url ?? null,
    estimatedReadyAt: raw.paid_at ? raw.paid_at + ESTIMATED_RENDER_SEC : null,
    accessRevoked: raw.access_revoked ?? 0,
  }
}

/**
 * Fetch all one-time purchase orders for a user, with linked video status.
 * Returns newest-first, capped at 50 rows.
 */
export async function getUserOrders(userId: string): Promise<OrderTimelineRow[]> {
  try {
    const _db = await getD1();
    if (!_db) throw new Error('D1 database binding not available');
    const db = _db;
    const result = await db
      .prepare(
        `SELECT
           p.id            AS purchase_id,
           p.sku,
           p.status        AS purchase_status,
           p.paid_at,
           p.credits_remaining,
           v.id            AS video_id,
           v.status        AS video_status,
           v.attempt_count,
           v.last_attempt_at,
           v.video_url,
           v.access_revoked
         FROM user_purchases p
         LEFT JOIN videos v ON v.purchase_id = p.id
         WHERE p.user_id = ?1
           AND p.kind = 'one_time'
         ORDER BY p.created_at DESC
         LIMIT 50`,
      )
      .bind(userId)
      .all<RawOrderRow>()

    return (result.results ?? []).map(toOrderTimelineRow)
  } catch (err) {
    logger.error('[OrderQuery] getUserOrders failed', err instanceof Error ? err : undefined, {
      userId,
    })
    return []
  }
}
