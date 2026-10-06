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
    const _db = await getD1();
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

function buildRunResult(
  paymentId: string,
  purchaseId: string | null,
  videoId: string | null,
  outcome: SyntheticRunResult['outcome'],
  timeline: SyntheticTimeline,
  errors: string[],
): SyntheticRunResult {
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

async function setupSyntheticPurchase(
  userId: string,
  skuId: OneTimeSkuId,
  sku: (typeof ONE_TIME_SKUS)[OneTimeSkuId],
  paymentId: string,
  errors: string[],
): Promise<string | null> {
  try {
    const expiresAt = Math.floor(Date.now() / 1000) + 365 * 24 * 3600
    const purchaseId = await insertPurchase({
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
      return null
    }

    // Mark as paid
    await markPaid(paymentId, sku.credits, Math.floor(Date.now() / 1000) + 365 * 24 * 3600)
    return purchaseId
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`Purchase setup failed: ${msg}`)
    return null
  }
}

export type OneTimeFulfillmentTrigger = (
  userId: string,
  purchaseId: string,
  sku: (typeof ONE_TIME_SKUS)[OneTimeSkuId],
) => Promise<unknown>;

let globalFulfillmentTrigger: OneTimeFulfillmentTrigger | null = null;

export function registerOneTimeFulfillmentTrigger(trigger: OneTimeFulfillmentTrigger | null): void {
  globalFulfillmentTrigger = trigger;
}

async function invokeFulfillmentTrigger(
  userId: string,
  purchaseId: string,
  sku: (typeof ONE_TIME_SKUS)[OneTimeSkuId],
  errors: string[],
): Promise<void> {
  const trigger = globalFulfillmentTrigger;
  if (!trigger) {
    errors.push('No fulfillment trigger registered');
    logger.warn('[SyntheticRunner] no fulfillment trigger registered', { purchaseId });
    return;
  }
  try {
    await trigger(userId, purchaseId, sku);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`triggerOneTimeFulfillment threw: ${msg}`);
    logger.warn('[SyntheticRunner] triggerOneTimeFulfillment threw', { msg, purchaseId });
  }
}

async function locateQueuedVideo(
  purchaseId: string,
  timeline: SyntheticTimeline,
  errors: string[],
): Promise<string | null> {
  try {
    const videoRow = await findByPurchaseId(purchaseId)
    if (videoRow) {
      timeline.queued_at = Date.now()
      if (videoRow.status === 'processing') timeline.processing_at = Date.now()
      if (videoRow.status === 'completed') timeline.completed_at = Date.now()
      return videoRow.id
    }
    errors.push('No videos row found after triggerOneTimeFulfillment')
    return null
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`findByPurchaseId failed: ${msg}`)
    return null
  }
}

async function handleVideoPollTick(
  videoId: string,
  timeline: SyntheticTimeline,
  errors: string[],
): Promise<boolean> {
  try {
    const _db = await getD1();
    if (!_db) throw new Error('D1 binding not available');
    const row = await _db
      .prepare(`SELECT id, status FROM videos WHERE id = ?1 LIMIT 1`)
      .bind(videoId)
      .first<VideoRow>()

    if (!row) {
      errors.push('Video row disappeared during polling')
      return true
    }

    if (row.status === 'processing' && timeline.processing_at === null) {
      timeline.processing_at = Date.now()
    }
    if (row.status === 'completed') {
      timeline.completed_at = Date.now()
      return true
    }
    if (row.status === 'failed' || row.status === 'failed_permanent') {
      errors.push(`Video status: ${row.status}`)
      return true
    }
    return false
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`Poll error: ${msg}`)
    return false
  }
}

async function pollVideoStatus(
  videoId: string,
  timeline: SyntheticTimeline,
  deadline: number,
  errors: string[],
): Promise<void> {
  while (Date.now() < deadline && timeline.completed_at === null) {
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS))
    const shouldStop = await handleVideoPollTick(videoId, timeline, errors)
    if (shouldStop) break
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
    return buildRunResult(paymentId, null, null, 'failed', timeline, errors)
  }

  const purchaseId = await setupSyntheticPurchase(userId, skuId, sku, paymentId, errors)
  if (!purchaseId) {
    return buildRunResult(paymentId, null, null, 'failed', timeline, errors)
  }

  await invokeFulfillmentTrigger(userId, purchaseId, sku, errors)

  const videoId = await locateQueuedVideo(purchaseId, timeline, errors)
  if (!videoId) {
    return buildRunResult(paymentId, purchaseId, null, 'failed', timeline, errors)
  }

  const deadline = Date.now() + timeoutMs
  await pollVideoStatus(videoId, timeline, deadline, errors)

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

  return buildRunResult(paymentId, purchaseId, videoId, outcome, timeline, errors)
}

