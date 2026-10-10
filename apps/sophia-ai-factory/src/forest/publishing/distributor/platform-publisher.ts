/**
 * Platform Publisher Engine with Circuit Breaker Guards
 * Layer: Forest
 *
 * @module forest/publishing/distributor/platform-publisher
 */

import type {
  ViralPlatform,
  ViralPublishInput,
  PlatformPublishResult,
  ViralPublishResult,
} from '@/seed/types/growth';
import { toError } from '@/seed/utils/to-error';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import { formatPlatformCaption } from './caption-formatter';
import { dispatchPlatformUpload } from './adapter-dispatcher';

const SERVICE_PREFIX = 'viral-distributor' as const;

/**
 * Publish video to a single platform with error containment and circuit breaker guards.
 */
export async function publishSinglePlatform(
  platform: ViralPlatform,
  input: ViralPublishInput,
): Promise<PlatformPublishResult> {
  const circuitKey = `${SERVICE_PREFIX}:${platform}`;

  if (!shouldAllowRequest(circuitKey)) {
    logger.warn('[ViralDistributor] Circuit breaker open for platform', { platform });
    return {
      platform,
      status: 'failed',
      trackedUrl: '',
      telegramDeepLink: '',
      caption: '',
      error: `Circuit breaker open for ${platform}`,
    };
  }

  const { caption, trackedUrl, telegramDeepLink } = formatPlatformCaption(platform, {
    videoTitle: input.videoTitle,
    scriptText: input.scriptText,
    niche: input.niche,
    hookArchetype: input.hookArchetype,
    videoId: input.videoId,
    referralCode: input.referralCode,
    customTelegramStart: input.customTelegramStart,
  });

  try {
    const { postId, postUrl, status } = await dispatchPlatformUpload(platform, input, caption);

    recordSuccess(circuitKey);
    logger.info('[ViralDistributor] Successfully published video to platform', {
      platform,
      videoId: input.videoId,
      postId,
      status,
    });

    return {
      platform,
      status,
      postId,
      postUrl,
      trackedUrl,
      telegramDeepLink,
      caption,
    };
  } catch (err) {
    const errorObj = toError(err);
    const classified = classifyError(errorObj);
    recordFailure(circuitKey, classified);
    logger.error('[ViralDistributor] Failed to publish video to platform', {
      platform,
      videoId: input.videoId,
      error: errorObj.message,
    });

    return {
      platform,
      status: 'failed',
      trackedUrl,
      telegramDeepLink,
      caption,
      error: errorObj.message,
    };
  }
}

/**
 * Automated multi-platform publishing workflow for TikTok, YouTube Shorts, and X.
 */
export async function publishToViralPlatforms(
  input: ViralPublishInput,
): Promise<ViralPublishResult> {
  const platforms = input.platforms && input.platforms.length > 0
    ? input.platforms
    : (['youtube_shorts', 'tiktok', 'instagram_reels', 'facebook_reels'] as ViralPlatform[]);

  const results: Partial<Record<ViralPlatform, PlatformPublishResult>> = {};
  let publishedCount = 0;
  let failedCount = 0;

  const promises = platforms.map(async (platform) => {
    const res = await publishSinglePlatform(platform, input);
    results[platform] = res;
    if (res.status === 'published' || res.status === 'scheduled' || res.status === 'simulated') {
      publishedCount++;
    } else {
      failedCount++;
    }
  });

  await Promise.all(promises);

  return {
    videoId: input.videoId,
    success: publishedCount > 0,
    results,
    publishedCount,
    failedCount,
  };
}
