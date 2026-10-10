import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { grantCompensationCredit } from '@/land/fulfillment/compensation';
import { sendBundleRenderFailedEmail } from '@/land/billing/email/send-bundle-render-failed-email';
import { deleteR2VideoArtifacts } from '@/land/r2/video-cleanup';
import type { VideoRow } from './sync-types';

export async function fetchUserInfo(
  userId: string,
): Promise<{ email: string; locale: string } | null> {
  try {
    const db = createServerClient();
    const { data } = await db.from('user').select('email, locale').eq('id', userId).single();
    const row = data as { email?: string; locale?: string } | null;
    if (!row?.email) return null;
    return { email: row.email, locale: row.locale ?? 'vi' };
  } catch {
    return null;
  }
}

export async function handleOneBundlePermanentFailure(
  db: D1Database,
  row: VideoRow,
  reason: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE videos SET status = 'failed_permanent', error = ?1, updated_at = ?2
       WHERE id = ?3`,
    )
    .bind(reason, new Date().toISOString(), row.id)
    .run();

  logger.warn('[video-status-sync] One-time bundle permanently failed', {
    videoId: row.id,
    purchaseId: row.purchase_id,
    reason,
  });

  const purchaseId = row.purchase_id!;

  if (row.r2_key) {
    await deleteR2VideoArtifacts(row.r2_key);
  }

  const clientDb = createServerClient();
  const result = await clientDb
    .from('user_purchases')
    .select('status')
    .eq('id', purchaseId)
    .single();
  const { data: purchaseData } = result;
  const purchase = purchaseData as { status: string } | null;

  if (purchase?.status === 'refunded') {
    logger.warn('[video-status-sync] Skipping email and compensation — purchase refunded', {
      purchaseId,
      videoId: row.id,
    });
    return;
  }

  await grantCompensationCredit(purchaseId, reason);

  const userInfo = await fetchUserInfo(row.user_id);
  await sendBundleRenderFailedEmail({
    userEmail: userInfo?.email,
    userId: row.user_id,
    purchaseId,
    locale: userInfo?.locale ?? row.locale ?? 'vi',
  });
}
