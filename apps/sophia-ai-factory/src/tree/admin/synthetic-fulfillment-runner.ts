/**
 * Synthetic Fulfillment Runner — admin-only E2E proof helper.
 *
 * Runs the full fulfillment pipeline with synthetic data, polls for
 * status transitions, and returns a detailed timeline report.
 *
 * Extracted from the route handler for unit testability.
 *
 * @module lib/admin/synthetic-fulfillment-runner
 */

import { logger } from '@/seed/utils/logger-utility'
import { getD1 } from '@/seed/db/client'
import {
  insertPurchase,
  markPaid,
} from '@/seed/db/repositories/user-purchases-repo'
import { findByPurchaseId } from '@/seed/db/repositories/videos-repo'
import { triggerOneTimeFulfillment } from '@/tree/fulfillment'
import { ONE_TIME_SKUS } from '@/seed/config/one-time-skus'
import type { OneTimeSkuId } from '@/seed/types'

const POLL_INTERVAL_MS = 3_000
const DEFAULT_TIMEOUT_MS = 60_000

export interface SyntheticTimeline {
  paid_at: number
  queued_at: number | null
  processing_at: number | null
  completed_at: number | null
  email_sent_at: number | null
}

export interface SyntheticDeltasMs {
  paid_to_queued: number | null
  queued_to_processing: number | null
  processing_to_completed: number | null
  total: number | null
}

export interface SyntheticRunResult {
  payment_id: string
  purchase_id: string | null
  video_id: string | null
  outcome: 'completed' | 'timeout' | 'failed'
  timeline: SyntheticTimeline
  deltas_ms: SyntheticDeltasMs
  errors: string[]
}

interface BillingEventRow {
  event_type: string
}

interface VideoRow {
  id: string
  status: string
}

async function checkEmailSent(purchaseId: string): Promise<number | null> {
  try {
    const _db = getD1();
    if (!_db) throw new Error('D1 binding not available');
    const db = _db;
    const row = await db
      .prepare(
        `SELECT event_type FROM billing_events
         WHERE purchase_id = ?1 AND event_type = 'bundle_ready_email_sent'
         LIMIT 1`,
      )
      .bind(purchaseId)
      .first<BillingEventRow>()
    return row ? Date.now() : null
  } catch {
    return null
  }
}

function computeDeltas(tl: SyntheticTimeline): SyntheticDeltasMs {
  return {
    paid_to_queued: tl.queued_at ? tl.queued_at - tl.paid_at : null,
    queued_to_processing:
      tl.queued_at && tl.processing_at ? tl.processing_at - tl.queued_at : null,
    processing_to_completed:
      tl.processing_at && tl.completed_at ? tl.completed_at - tl.processing_at : null,
    total: tl.completed_at ? tl.completed_at - tl.paid_at : null,
  }
}

/**
 * Run a synthetic fulfillment E2E test.
 *
 * @param userId - Admin user ID (used as purchase owner)
 * @param skuId  - SKU to test (default: STARTER_BUNDLE)
 * @param timeoutMs - Max wait time in ms (default: 60000)
 */
export async function runSyntheticFulfillment(
  userId: string,
  skuId: OneTimeSkuId = 'STARTER_BUNDLE',
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<SyntheticRunResult> {
  const errors: string[] = []
  const paymentId = `ADMIN_SYNTHETIC_${Date.now()}`
  const paid_at = Date.now()
  const sku = ONE_TIME_SKUS[skuId]

  const timeline: SyntheticTimeline = {
    paid_at,
    queued_at: null,
    processing_at: null,
    completed_at: null,
    email_sent_at: null,
  }

  if (!sku) {
    errors.push(`Unknown SKU: ${skuId}`)
    return {
      payment_id: paymentId,
      purchase_id: null,
      video_id: null,
      outcome: 'failed',
      timeline,
      deltas_ms: computeDeltas(timeline),
      errors,
    }
  }

  // Step 1: Insert synthetic purchase
  let purchaseId: string | null = null
  try {
    const expiresAt = Math.floor(Date.now() / 1000) + 365 * 24 * 3600
    purchaseId = await insertPurchase({
      userId,
      kind: 'one_time',
      sku: skuId,
      paymentId,
      amountCents: sku.priceUsd * 100,
      creditsTotal: sku.credits,
      expiresAt,
      status: 'pending',
    })

    if (!purchaseId) {
      errors.push('insertPurchase returned null')
      return {
        payment_id: paymentId,
        purchase_id: null,
        video_id: null,
        outcome: 'failed',
        timeline,
        deltas_ms: computeDeltas(timeline),
        errors,
      }
    }

    // Mark as paid
    await markPaid(paymentId, sku.credits, Math.floor(Date.now() / 1000) + 365 * 24 * 3600)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`Purchase setup failed: ${msg}`)
    return {
      payment_id: paymentId,
      purchase_id: purchaseId,
      video_id: null,
      outcome: 'failed',
      timeline,
      deltas_ms: computeDeltas(timeline),
      errors,
    }
  }

  // Step 2: Trigger fulfillment
  try {
    await triggerOneTimeFulfillment(userId, purchaseId, sku)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`triggerOneTimeFulfillment threw: ${msg}`)
    logger.warn('[SyntheticRunner] triggerOneTimeFulfillment threw', { msg, purchaseId })
  }

  // Step 3: Check if video row was queued
  let videoId: string | null = null
  try {
    const videoRow = await findByPurchaseId(purchaseId)
    if (videoRow) {
      videoId = videoRow.id
      timeline.queued_at = Date.now()
      if (videoRow.status === 'processing') timeline.processing_at = Date.now()
      if (videoRow.status === 'completed') timeline.completed_at = Date.now()
    } else {
      errors.push('No videos row found after triggerOneTimeFulfillment')
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`findByPurchaseId failed: ${msg}`)
  }

  if (!videoId) {
    return {
      payment_id: paymentId,
      purchase_id: purchaseId,
      video_id: null,
      outcome: 'failed',
      timeline,
      deltas_ms: computeDeltas(timeline),
      errors,
    }
  }

  // Step 4: Poll for status transitions
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline && timeline.completed_at === null) {
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS))

    try {
      const _db = getD1();
    if (!_db) throw new Error('D1 binding not available');
    const db = _db;
      const row = await db
        .prepare(
          `SELECT id, status FROM videos WHERE id = ?1 LIMIT 1`,
        )
        .bind(videoId)
        .first<VideoRow>()

      if (!row) {
        errors.push('Video row disappeared during polling')
        break
      }

      if (row.status === 'processing' && timeline.processing_at === null) {
        timeline.processing_at = Date.now()
      }
      if (row.status === 'completed') {
        timeline.completed_at = Date.now()
        break
      }
      if (row.status === 'failed' || row.status === 'failed_permanent') {
        errors.push(`Video status: ${row.status}`)
        break
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`Poll error: ${msg}`)
    }
  }

  // Step 5: Check email
  timeline.email_sent_at = await checkEmailSent(purchaseId)

  const outcome =
    timeline.completed_at !== null
      ? 'completed'
      : Date.now() >= deadline
        ? 'timeout'
        : 'failed'

  logger.info('[SyntheticRunner] Run complete', {
    paymentId,
    purchaseId,
    videoId,
    outcome,
    errors: errors.length,
  })

  return {
    payment_id: paymentId,
    purchase_id: purchaseId,
    video_id: videoId,
    outcome,
    timeline,
    deltas_ms: computeDeltas(timeline),
    errors,
  }
}
