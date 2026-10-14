/**
 * Synthetic Fulfillment Runner Service
 *
 * Implements fulfillment trigger invocation, video polling, and runner lifecycle.
 *
 * Layer: tree/admin/synthetic
 */

import { logger } from '@/seed/utils/logger-utility';
import { ONE_TIME_SKUS } from '@/seed/config/one-time-skus';
import type { OneTimeSkuId } from '@/seed/types';
import {
  DEFAULT_TIMEOUT_MS,
  type SyntheticTimeline,
  type SyntheticRunResult,
  type OneTimeFulfillmentTrigger,
} from './types';
import {
  checkEmailSent,
  buildRunResult,
  setupSyntheticPurchase,
} from './scenario-builder';
import {
  locateQueuedVideo,
  pollVideoStatus,
} from './synthetic-video-poller';

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
