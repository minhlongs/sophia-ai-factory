import { logger } from '@/seed/utils/logger-utility';
import {
  findByHeygenJobId,
  recordWebhookAttemptCAS,
  markWebhookPermanentFailureCAS,
} from '@/seed/db/repositories/videos-repo';
import { MAX_ATTEMPTS } from '@/land/fulfillment/retry-backoff';
import { recordHeyGenAttempt } from '@/seed/utils/circuit-breaker';
import type { HeyGenFailData } from './types';
import { handleFailureCompensation } from './webhook-notification';

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
