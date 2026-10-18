/**
 * Platform Caption Formatter with Tracking Link and Hashtag Injection
 * Layer: Forest
 *
 * @module forest/publishing/distributor/caption-formatter
 */

import type {
  ViralPlatform,
  ViralNiche,
  HookArchetype,
} from '@/seed/types/growth';
import { NICHE_PROFILES } from '@/tree/viral/hook-prompts';
import { buildFunnelTrackingUrl, buildTelegramDeepLink } from './tracking-urls';
import {
  buildPlatformCaptionText,
  type CaptionBuilderParams,
} from './caption-platform-builders';

export { buildPlatformCaptionText, type CaptionBuilderParams };

/**
 * Format platform-specific captions with injected links, calls to action, and hashtags.
 */
export function formatPlatformCaption(
  platform: ViralPlatform,
  options: {
    videoTitle: string;
    scriptText?: string;
    niche: ViralNiche;
    hookArchetype: HookArchetype;
    videoId: string;
    referralCode?: string;
    customTelegramStart?: string;
  },
): {
  caption: string;
  trackedUrl: string;
  telegramDeepLink: string;
} {
  const { videoTitle, scriptText, niche, hookArchetype, videoId, referralCode, customTelegramStart } = options;

  const trackedUrl = buildFunnelTrackingUrl({
    platform,
    niche,
    hookArchetype,
    videoId,
    referralCode,
  });

  const telegramDeepLink = buildTelegramDeepLink({
    videoId,
    platform,
    niche,
    referralCode,
    customStart: customTelegramStart,
  });

  const profile = NICHE_PROFILES[niche];
  const tags = profile.recommendedKeywords.join(' ');

  const caption = buildPlatformCaptionText({
    platform,
    videoTitle,
    scriptText,
    trackedUrl,
    telegramDeepLink,
    tags,
  });

  return { caption, trackedUrl, telegramDeepLink };
}
