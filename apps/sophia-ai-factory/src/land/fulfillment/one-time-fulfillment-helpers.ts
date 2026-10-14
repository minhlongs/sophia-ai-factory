/**
 * Synthetic monitoring and HeyGen dispatch helpers for one-time bundle fulfillment.
 * @module land/fulfillment/one-time-fulfillment-helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import { createHeyGenVideo } from '@/land/video/templates/heygen-helpers';
import { getHeyGenKey } from '@/tree/credentials/get-provider-key';
import {
  enqueueVideo,
  markVideoProcessing,
  markVideoCompletedSynthetic,
  recordAttempt,
} from '@/seed/db/repositories/videos-repo';
import { shouldDispatch, recordHeyGenAttempt } from '@/seed/utils/circuit-breaker';
import type { OneTimeSku } from '@/seed/types';

export async function handleSyntheticFulfillment(
  userId: string,
  purchaseId: string,
  sku: OneTimeSku,
): Promise<void> {
  try {
    const videoRowId = await enqueueVideo({
      userId,
      purchaseId,
      title: `Synthetic Monitoring — ${sku.id}`,
      script: 'synthetic-monitoring',
      locale: 'en',
    });
    await markVideoCompletedSynthetic(videoRowId);
    logger.info('[OneTimeFulfillment] Synthetic monitoring purchase fulfilled', {
      userId,
      purchaseId,
      videoRowId,
    });
  } catch (err) {
    logger.error(
      '[OneTimeFulfillment] Synthetic monitoring enqueue failed',
      err instanceof Error ? err : undefined,
      { userId, purchaseId },
    );
  }
}

export async function dispatchHeyGenWelcomeVideo(params: {
  userId: string;
  purchaseId: string;
  videoRowId: string;
  script: string;
  title: string;
}): Promise<void> {
  const { userId, purchaseId, videoRowId, script, title } = params;

  const dispatch = await shouldDispatch();
  if (!dispatch.allowed) {
    await recordAttempt(videoRowId, `circuit_open: ${dispatch.reason ?? 'unknown'}`);
    logger.warn('[OneTimeFulfillment] Circuit breaker blocked HeyGen dispatch', {
      videoRowId,
      purchaseId,
      reason: dispatch.reason,
    });
    return;
  }

  const keyResult = await getHeyGenKey({ userId, fallbackToPlatform: false });
  if (!keyResult) {
    await recordAttempt(videoRowId, 'no_user_heygen_key');
    logger.warn('[OneTimeFulfillment] No user HeyGen key — video queued for retry', {
      videoRowId,
      purchaseId,
      userId,
    });
    return;
  }
  const apiKey = keyResult.key;

  const callbackUrl =
    process.env.NODE_ENV === 'production'
      ? `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/webhooks/heygen`
      : undefined;

  try {
    const { videoId: heygenJobId } = await createHeyGenVideo({ script, title, apiKey, callbackUrl });
    await markVideoProcessing(videoRowId, heygenJobId);
    await recordHeyGenAttempt(true);
    logger.info('[OneTimeFulfillment] HeyGen video submitted', {
      userId,
      purchaseId,
      heygenJobId,
      videoRowId,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await recordAttempt(videoRowId, errMsg);
    await recordHeyGenAttempt(false);
    logger.error(
      '[OneTimeFulfillment] HeyGen call failed — queued for retry',
      err instanceof Error ? err : undefined,
      { userId, purchaseId, videoRowId },
    );
  }
}
