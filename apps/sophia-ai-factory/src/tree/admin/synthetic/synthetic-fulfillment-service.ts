/**
 * Synthetic Fulfillment Runner Service
 *
 * Implements fulfillment trigger invocation, video polling, and runner lifecycle.
 *
 * Layer: tree/admin/synthetic
 */

import { logger } from '@/seed/utils/logger-utility';
import { getD1 } from '@/seed/db/client';
import { findByPurchaseId } from '@/seed/db/repositories/videos-repo';
import { ONE_TIME_SKUS } from '@/seed/config/one-time-skus';
import type { OneTimeSkuId } from '@/seed/types';
import {
  POLL_INTERVAL_MS,
  DEFAULT_TIMEOUT_MS,
  type SyntheticTimeline,
  type SyntheticRunResult,
  type VideoRow,
  type OneTimeFulfillmentTrigger,
} from './types';
import {
  checkEmailSent,
  buildRunResult,
  setupSyntheticPurchase,
} from './scenario-builder';

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
    const videoRow = await findByPurchaseId(purchaseId);
    if (videoRow) {
      timeline.queued_at = Date.now();
      if (videoRow.status === 'processing') timeline.processing_at = Date.now();
      if (videoRow.status === 'completed') timeline.completed_at = Date.now();
      return videoRow.id;
    }
    errors.push('No videos row found after triggerOneTimeFulfillment');
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`findByPurchaseId failed: ${msg}`);
    return null;
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
      .first<VideoRow>();

    if (!row) {
      errors.push('Video row disappeared during polling');
      return true;
    }

    if (row.status === 'processing' && timeline.processing_at === null) {
      timeline.processing_at = Date.now();
    }
    if (row.status === 'completed') {
      timeline.completed_at = Date.now();
      return true;
    }
    if (row.status === 'failed' || row.status === 'failed_permanent') {
      errors.push(`Video status: ${row.status}`);
      return true;
    }
    return false;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Poll error: ${msg}`);
    return false;
  }
}

async function pollVideoStatus(
  videoId: string,
  timeline: SyntheticTimeline,
  deadline: number,
  errors: string[],
): Promise<void> {
  while (Date.now() < deadline && timeline.completed_at === null) {
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
    const shouldStop = await handleVideoPollTick(videoId, timeline, errors);
    if (shouldStop) break;
  }
}

/**
 * Run a synthetic fulfillment E2E test.
 */
export async function runSyntheticFulfillment(
  userId: string,
  skuId: OneTimeSkuId = 'STARTER_BUNDLE',
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<SyntheticRunResult> {
  const errors: string[] = [];
  const paymentId = `ADMIN_SYNTHETIC_${Date.now()}`;
  const paid_at = Date.now();
  const sku = ONE_TIME_SKUS[skuId];

  const timeline: SyntheticTimeline = {
    paid_at,
    queued_at: null,
    processing_at: null,
    completed_at: null,
    email_sent_at: null,
  };

  if (!sku) {
    errors.push(`Unknown SKU: ${skuId}`);
    return buildRunResult(paymentId, null, null, 'failed', timeline, errors);
  }

  const purchaseId = await setupSyntheticPurchase(userId, skuId, sku, paymentId, errors);
  if (!purchaseId) {
    return buildRunResult(paymentId, null, null, 'failed', timeline, errors);
  }

  await invokeFulfillmentTrigger(userId, purchaseId, sku, errors);

  const videoId = await locateQueuedVideo(purchaseId, timeline, errors);
  if (!videoId) {
    return buildRunResult(paymentId, purchaseId, null, 'failed', timeline, errors);
  }

  const deadline = Date.now() + timeoutMs;
  await pollVideoStatus(videoId, timeline, deadline, errors);

  timeline.email_sent_at = await checkEmailSent(purchaseId);

  const outcome =
    timeline.completed_at !== null
      ? 'completed'
      : Date.now() >= deadline
        ? 'timeout'
        : 'failed';

  logger.info('[SyntheticRunner] Run complete', {
    paymentId,
    purchaseId,
    videoId,
    outcome,
    errors: errors.length,
  });

  return buildRunResult(paymentId, purchaseId, videoId, outcome, timeline, errors);
}
