/**
 * One-Time bundle fulfillment — queue-first video gen after purchase.
 * @module lib/fulfillment/one-time-fulfillment
 */

import { logger } from '@/seed/utils/logger-utility';
import { createServerClient } from '@/seed/db/client';
import { registerOneTimeFulfillmentTrigger } from '@/tree/admin/synthetic-fulfillment-runner';
import { getOneTimeWelcomeScript } from '@/land/video/generation/one-time-welcome-script';
import {
  findByPurchaseId,
  enqueueVideo,
} from '@/seed/db/repositories/videos-repo';
import { sendBundleGeneratingEmail } from '@/land/billing/email/send-bundle-generating-email';
import { isSyntheticMonitoringUser } from '@/seed/config/synthetic-monitoring';
import type { OneTimeSku } from '@/seed/types';
import {
  handleSyntheticFulfillment,
  dispatchHeyGenWelcomeVideo,
} from './one-time-fulfillment-helpers';

interface UserRow {
  email?: string;
  locale?: string;
}

/**
 * Trigger fulfillment for a completed one-time bundle purchase.
 * Non-throwing: all errors are handled internally with retry-safe state.
 */
export async function triggerOneTimeFulfillment(
  userId: string,
  purchaseId: string,
  sku: OneTimeSku,
): Promise<void> {
  const existing = await findByPurchaseId(purchaseId);
  if (existing) {
    logger.info('[OneTimeFulfillment] Video row already exists, skipping enqueue', {
      purchaseId,
      videoId: existing.id,
      status: existing.status,
    });
    return;
  }

  if (isSyntheticMonitoringUser(userId)) {
    await handleSyntheticFulfillment(userId, purchaseId, sku);
    return;
  }

  const db = createServerClient();
  const { data: userData } = await db
    .from('user')
    .select('email, locale')
    .eq('id', userId)
    .single();
  const user = userData as UserRow | null;
  const locale = user?.locale ?? 'vi';

  const script = getOneTimeWelcomeScript(sku, locale);
  const title = `Welcome Bundle — ${sku.id} — ${userId.slice(0, 8)}`;

  let videoRowId: string;
  try {
    videoRowId = await enqueueVideo({ userId, purchaseId, title, script, locale });
  } catch (err) {
    logger.error(
      '[OneTimeFulfillment] Failed to enqueue video row',
      err instanceof Error ? err : undefined,
      { userId, purchaseId },
    );
    return;
  }

  if (user?.email) {
    sendBundleGeneratingEmail({
      userEmail: user.email,
      userId,
      purchaseId,
      sku: sku.id,
      skuLabel: locale === 'vi' ? (sku.label_vi ?? sku.id) : (sku.label_en ?? sku.id),
      creditsTotal: sku.credits,
      locale,
    }).catch((emailErr) => {
      logger.error(
        '[OneTimeFulfillment] Generating email failed (non-fatal)',
        emailErr instanceof Error ? emailErr : undefined,
        { userId, purchaseId },
      );
    });
  }

  await dispatchHeyGenWelcomeVideo({
    userId,
    purchaseId,
    videoRowId,
    script,
    title,
  });
}

registerOneTimeFulfillmentTrigger(triggerOneTimeFulfillment);
