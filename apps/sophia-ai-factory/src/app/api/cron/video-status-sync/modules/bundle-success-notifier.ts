import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { sendOneTimeBundleReadyEmail } from '@/land/billing/email/send-one-time-bundle-ready-email';
import { getUserCredits } from '@/seed/db/get-user-credits';
import type { VideoRow } from './sync-types';

export async function handleBundleSuccessNotification(
  row: VideoRow,
  r2Key: string | null,
  videoStatusUrl?: string | null,
): Promise<void> {
  if (!row.purchase_id) return;

  try {
    const videoUrl = r2Key
      ? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network'}/dashboard/videos`
      : (videoStatusUrl ?? undefined);
    const clientDb = createServerClient();
    const { data: purchaseData } = await clientDb
      .from('user_purchases')
      .select('user_id, credits_remaining, status')
      .eq('id', row.purchase_id)
      .single();
    const purchase = purchaseData as {
      user_id?: string;
      credits_remaining?: number;
      status?: string;
    } | null;

    if (purchase?.status === 'refunded') {
      logger.info('[video-status-sync] Skipping ready email — purchase refunded', {
        videoId: row.id,
        purchaseId: row.purchase_id,
      });
      return;
    }

    const ownerUserId = purchase?.user_id ?? row.user_id;
    const { data: userData } = await clientDb
      .from('user')
      .select('email, locale')
      .eq('id', ownerUserId)
      .single();
    const user = userData as { email?: string; locale?: string } | null;
    if (user?.email) {
      const { creditsRemaining } = await getUserCredits(ownerUserId);
      await sendOneTimeBundleReadyEmail({
        userEmail: user.email,
        userId: ownerUserId,
        purchaseId: row.purchase_id,
        creditsRemaining,
        videoUrl: videoUrl ?? null,
        locale: user.locale ?? 'vi',
      });
    }
  } catch (emailErr) {
    logger.warn('[video-status-sync] One-time bundle email failed (non-fatal)', {
      videoId: row.id,
      purchaseId: row.purchase_id,
      error: emailErr instanceof Error ? emailErr.message : String(emailErr),
    });
  }
}
