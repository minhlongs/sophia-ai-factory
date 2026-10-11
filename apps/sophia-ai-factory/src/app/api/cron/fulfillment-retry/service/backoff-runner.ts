import { createServerClient } from '@/seed/db/client';
import { createHeyGenVideo } from '@/land/video/templates/heygen-helpers';
import { getHeyGenKey } from '@/tree/credentials/get-provider-key';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  markVideoProcessing,
  recordAttemptCAS,
  markPermanentFailureCAS,
  type VideoRow,
} from '@/seed/db/repositories/videos-repo';
import { MAX_ATTEMPTS } from '@/land/fulfillment/retry-backoff';
import { grantCompensationCredit } from '@/land/fulfillment/compensation';
import { sendBundleRenderFailedEmail, type SendBundleRenderFailedInput } from '@/land/billing/email/send-bundle-render-failed-email';
import { recordHeyGenAttempt } from '@/seed/utils/circuit-breaker';
import type { RetrySummary } from './types';
import { fetchUserEmail } from './retry-queue-finder';

/**
 * Retries a single queued video row with exponential backoff handling and compensation CAS.
 */
export async function processRowRetry(
  row: VideoRow,
  summary: RetrySummary,
): Promise<void> {
  summary.retried++;

  try {
    const keyResult = await getHeyGenKey({ userId: row.user_id, fallbackToPlatform: false });
    if (!keyResult) {
      await recordAttemptCAS(row.id, 'no_user_heygen_key');
      summary.failed++;
      return;
    }
    const rowApiKey = keyResult.key;

    const script = row.script ?? '';
    const title = `Welcome Bundle — ${row.id.slice(0, 8)}`;
    const callbackUrl =
      process.env.NODE_ENV === 'production'
        ? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/webhooks/heygen`
        : undefined;

    try {
      const { videoId: heygenJobId } = await createHeyGenVideo({ script, title, apiKey: rowApiKey, callbackUrl });
      await markVideoProcessing(row.id, heygenJobId);
      try { await recordHeyGenAttempt(true); } catch { /* non-fatal */ }
      summary.succeeded++;

      logger.info('[fulfillment-retry] Retry succeeded', {
        videoId: row.id,
        purchaseId: row.purchase_id,
        heygenJobId,
      });
    } catch (err) {
      const errMsg = getErrorMessage(err);
      const nextAttemptCount = row.attempt_count + 1;
      try { await recordHeyGenAttempt(false); } catch { /* non-fatal */ }

      if (nextAttemptCount >= MAX_ATTEMPTS) {
        const won = await markPermanentFailureCAS(row.id, errMsg, nextAttemptCount - 1);
        if (!won) {
          logger.info('[fulfillment-retry] CAS lost — permanent failure already set', {
            videoId: row.id,
          });
          summary.skipped++;
          return;
        }

        summary.permanent++;

        logger.warn('[fulfillment-retry] Permanent failure — compensating', {
          videoId: row.id,
          purchaseId: row.purchase_id,
          attempts: nextAttemptCount,
        })

        if (row.purchase_id) {
          const clientDb = createServerClient();
          const { data: purchaseData } = await clientDb
            .from('user_purchases')
            .select('status')
            .eq('id', row.purchase_id)
            .single();
          const purchase = purchaseData as { status?: string } | null;
          if (purchase?.status === 'refunded') {
            logger.info('[fulfillment-retry] Skipping email and compensation — purchase refunded', {
              videoId: row.id,
              purchaseId: row.purchase_id,
            });
            return;
          }

          await grantCompensationCredit(row.purchase_id, 'render_failed_permanent');

          const userInfo = await fetchUserEmail(row.user_id);
          const failedEmailInput: SendBundleRenderFailedInput = {
            userEmail: userInfo?.email,
            userId: row.user_id,
            purchaseId: row.purchase_id,
            locale: userInfo?.locale ?? row.locale ?? 'vi',
          };
          await sendBundleRenderFailedEmail(failedEmailInput);
        }
      } else {
        const newCount = await recordAttemptCAS(row.id, errMsg);
        if (newCount === null) {
          logger.info('[fulfillment-retry] CAS lost — row already transitioned, skipping', {
            videoId: row.id,
          });
          summary.skipped++;
          return;
        }
        summary.failed++;

        logger.warn('[fulfillment-retry] Attempt failed', {
          videoId: row.id,
          purchaseId: row.purchase_id,
          attempt: newCount,
          error: errMsg,
        });
      }
    }
  } catch (unexpectedErr) {
    summary.failed++;
    logger.error('[fulfillment-retry] Unexpected error processing row', {
      videoId: row.id,
      error: getErrorMessage(unexpectedErr),
    });
  }
}
