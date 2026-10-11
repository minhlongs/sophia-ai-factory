import { logger } from '@/seed/utils/logger-utility';
import { getD1 } from '@/seed/db/client';
import {
  findByHeygenJobId,
  recordWebhookAttemptCAS,
  markWebhookPermanentFailureCAS,
} from '@/seed/db/repositories/videos-repo';
import { MAX_ATTEMPTS } from '@/land/fulfillment/retry-backoff';
import { recordHeyGenAttempt } from '@/seed/utils/circuit-breaker';
import type { HeyGenSuccessData, HeyGenFailData } from './types';
import { transferVideoAssetToR2 } from './r2-asset-transfer';
import { sendBundleReadyNotification, handleFailureCompensation } from './webhook-notification';

/**
 * Handle avatar_video.success webhook event.
 * Updates video row to completed, copies to R2, sends ready email.
 * Idempotent: no-op if row already in terminal state.
 *
 * M4 fix: skips ready email if linked purchase is refunded.
 */
export async function completeVideoFromWebhook(
  data: HeyGenSuccessData,
  ownerUserId?: string | null,
): Promise<void> {
  const { video_id: heygenJobId, video_url: videoUrl, thumbnail_url: thumbnailUrl } = data;

  const row = await findByHeygenJobId(heygenJobId, ownerUserId);
  if (!row) {
    logger.warn('[WebhookComplete] Unknown heygen_job_id', { heygenJobId });
    return;
  }

  // Idempotency — already terminal
  if (row.status === 'completed' || row.status === 'failed_permanent') {
    logger.info('[WebhookComplete] Already in terminal state, skipping', {
      videoId: row.id,
      status: row.status,
    });
    return;
  }

  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const now = Math.floor(Date.now() / 1000);

  // Copy to R2 (best-effort)
  const { r2Key, r2SizeBytes } = await transferVideoAssetToR2(videoUrl, row.id, row.user_id);

  // Atomic CAS: only transition from 'processing' to 'completed'
  const nowEpoch = Math.floor(Date.now() / 1000);
  const result = await db
    .prepare(
      `UPDATE videos
       SET status = 'completed',
           video_url = ?2,
           thumbnail_url = ?3,
           r2_key = ?4,
           r2_size_bytes = ?5,
           updated_at = ?6,
           completed_at = COALESCE(completed_at, ?7)
       WHERE id = ?1 AND status = 'processing'`,
    )
    .bind(row.id, videoUrl, thumbnailUrl ?? null, r2Key, r2SizeBytes, now, nowEpoch)
    .run();

  const updated = (result.meta?.changes ?? 0) > 0;
  if (!updated) {
    logger.warn('[WebhookComplete] CAS lost — video status not processing (may have been completed or failed by another caller)', {
      videoId: row.id,
      currentStatus: row.status,
    });
    return;
  }

  // Record HeyGen success so circuit breaker observes all outcomes
  try { await recordHeyGenAttempt(true); } catch { /* non-fatal */ }

  logger.info('[WebhookComplete] Video marked completed', { videoId: row.id, heygenJobId });

  await sendBundleReadyNotification(row, videoUrl, r2Key);
}

/**
 * Handle avatar_video.fail webhook event.
 * Bumps attempt_count via CAS. If >= MAX_ATTEMPTS → permanent failure + compensation.
 * Idempotent: no-op if already terminal.
 */
export async function failVideoFromWebhook(
  data: HeyGenFailData,
  ownerUserId?: string | null,
): Promise<void> {
  const { video_id: heygenJobId, error: errorMsg } = data;

  const row = await findByHeygenJobId(heygenJobId, ownerUserId);
  if (!row) {
    logger.warn('[WebhookFail] Unknown heygen_job_id', { heygenJobId });
    return;
  }

  if (row.status === 'completed' || row.status === 'failed_permanent') {
    logger.info('[WebhookFail] Already in terminal state, skipping', {
      videoId: row.id,
      status: row.status,
    });
    return;
  }

  const errorText = errorMsg ?? 'webhook_fail';
  const nextAttemptCount = row.attempt_count + 1;

  // Record HeyGen failure so circuit breaker observes webhook-reported failures
  try { await recordHeyGenAttempt(false); } catch { /* non-fatal */ }

  if (nextAttemptCount >= MAX_ATTEMPTS) {
    const won = await markWebhookPermanentFailureCAS(row.id, errorText, nextAttemptCount - 1);
    if (!won) {
      logger.info('[WebhookFail] CAS lost — another caller already marked permanent failure', {
        videoId: row.id,
      });
      return;
    }

    logger.warn('[WebhookFail] Permanent failure after max attempts', {
      videoId: row.id,
      attempts: nextAttemptCount,
      error: errorText,
    });

    await handleFailureCompensation(row);
  } else {
    const newCount = await recordWebhookAttemptCAS(row.id, errorText);
    if (newCount === null) {
      logger.info('[WebhookFail] CAS lost — row already transitioned, skipping recordAttempt', {
        videoId: row.id,
      });
      return;
    }

    logger.warn('[WebhookFail] Attempt recorded, retry cron will requeue', {
      videoId: row.id,
      attempt: newCount,
      error: errorText,
    });
  }
}
