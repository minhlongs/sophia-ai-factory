import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { createServerClient } from '@/seed/db/client';
import { sendOneTimeBundleReadyEmail } from '@/land/billing/email/send-one-time-bundle-ready-email';
import { getUserCredits } from '@/seed/db/get-user-credits';
import { grantCompensationCredit } from '@/land/fulfillment/compensation';
import { sendBundleRenderFailedEmail } from '@/land/billing/email/send-bundle-render-failed-email';
import type { VideoRow } from '@/seed/db/repositories/videos-repo';
import { fetchUserInfo } from './webhook-verifier';

/**
 * Sends bundle ready email for one-time bundle purchases if not refunded.
 */
export async function sendBundleReadyNotification(
  row: VideoRow,
  videoUrl: string,
  r2Key: string | null,
): Promise<void> {
  if (!row.purchase_id) return;

  try {
    const clientDb = createServerClient();
    const { data: purchaseData } = await clientDb
      .from('user_purchases')
      .select('status')
      .eq('id', row.purchase_id)
      .single();
    const purchase = purchaseData as { status?: string } | null;

    if (purchase?.status === 'refunded') {
      logger.info('[WebhookComplete] Skipping ready email — purchase refunded', {
        videoId: row.id,
        purchaseId: row.purchase_id,
      });
      return;
    }

    const userInfo = await fetchUserInfo(row.user_id);
    if (!userInfo) return;

    const { creditsRemaining } = await getUserCredits(row.user_id);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';
    const videoPageUrl = r2Key ? `${appUrl}/dashboard/orders` : videoUrl;

    await sendOneTimeBundleReadyEmail({
      userEmail: userInfo.email,
      userId: row.user_id,
      purchaseId: row.purchase_id,
      creditsRemaining,
      videoUrl: videoPageUrl,
      locale: userInfo.locale,
    });
  } catch (emailErr) {
    logger.warn('[WebhookComplete] Ready email failed (non-fatal)', {
      videoId: row.id,
      error: getErrorMessage(emailErr),
    });
  }
}

/**
 * Handles compensation credit and failure notification on permanent failure.
 */
export async function handleFailureCompensation(
  row: VideoRow,
): Promise<void> {
  if (!row.purchase_id) return;

  const clientDb = createServerClient();
  const { data: purchaseData } = await clientDb
    .from('user_purchases')
    .select('status')
    .eq('id', row.purchase_id)
    .single();
  const purchase = purchaseData as { status: string } | null;
  if (purchase?.status === 'refunded') {
    logger.info('[WebhookFail] Skipping email and compensation — purchase refunded', { purchaseId: row.purchase_id });
    return;
  }
  await grantCompensationCredit(row.purchase_id, 'render_failed_permanent');

  const userInfo = await fetchUserInfo(row.user_id);
  await sendBundleRenderFailedEmail({
    userEmail: userInfo?.email,
    userId: row.user_id,
    purchaseId: row.purchase_id,
    locale: userInfo?.locale ?? row.locale ?? 'vi',
  });
}
