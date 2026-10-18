/**
 * Compensation handler for permanent failures in fulfillment retry.
 * Layer: app/api/cron/fulfillment-retry/service
 * @module app/api/cron/fulfillment-retry/service/compensation-handler
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { markPermanentFailureCAS, type VideoRow } from '@/seed/db/repositories/videos-repo';
import { grantCompensationCredit } from '@/land/fulfillment/compensation';
import { sendBundleRenderFailedEmail, type SendBundleRenderFailedInput } from '@/land/billing/email/send-bundle-render-failed-email';
import type { RetrySummary } from './types';
import { fetchUserEmail } from './retry-queue-finder';

export async function handlePermanentFailure(
  row: VideoRow,
  errMsg: string,
  nextAttemptCount: number,
  summary: RetrySummary,
): Promise<boolean> {
  const won = await markPermanentFailureCAS(row.id, errMsg, nextAttemptCount - 1);
  if (!won) {
    logger.info('[fulfillment-retry] CAS lost — permanent failure already set', {
      videoId: row.id,
    });
    summary.skipped++;
    return false;
  }

  summary.permanent++;

  logger.warn('[fulfillment-retry] Permanent failure — compensating', {
    videoId: row.id,
    purchaseId: row.purchase_id,
    attempts: nextAttemptCount,
  });

  if (!row.purchase_id) {
    return true;
  }

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
    return true;
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
  return true;
}