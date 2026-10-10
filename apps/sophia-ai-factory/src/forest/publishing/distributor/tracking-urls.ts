/**
 * Tracking and Deep Link URL Builders
 * Layer: Forest
 *
 * @module forest/publishing/distributor/tracking-urls
 */

import type { TrackingUrlOptions, TelegramDeepLinkOptions } from './types';

/**
 * Construct canonical tracked funnel URL with standard UTM parameters.
 */
export function buildFunnelTrackingUrl(options: TrackingUrlOptions): string {
  const {
    baseUrl = 'https://sophia.agencyos.network',
    platform,
    niche,
    hookArchetype,
    videoId,
    referralCode,
  } = options;

  const url = new URL(baseUrl);
  const utmSource = platform === 'x' ? 'twitter' : platform;

  url.searchParams.set('utm_source', utmSource);
  url.searchParams.set('utm_medium', 'short_video');
  url.searchParams.set('utm_campaign', niche);
  url.searchParams.set('utm_content', `${hookArchetype}_${videoId}`);

  if (referralCode && referralCode.trim().length > 0) {
    url.searchParams.set('ref', referralCode.trim());
  }

  return url.toString();
}

/**
 * Construct Telegram Bot deep link for instant interactive lead qualification.
 */
export function buildTelegramDeepLink(options: TelegramDeepLinkOptions): string {
  const {
    botUsername = 'Sophia_Bbot',
    videoId,
    platform,
    niche,
    referralCode,
    customStart,
  } = options;

  if (customStart && customStart.trim().length > 0) {
    return `https://t.me/${botUsername}?start=${encodeURIComponent(customStart.trim())}`;
  }

  const cleanPlatform =
    platform === 'x' || platform === 'twitter'
      ? 'tw'
      : platform === 'youtube_shorts'
        ? 'yt'
        : platform === 'tiktok'
          ? 'tt'
          : platform === 'instagram_reels'
            ? 'ig'
            : platform === 'facebook_reels'
              ? 'fb'
              : 'so';
  const cleanVideoId = videoId.startsWith('vid_') ? videoId.slice(4) : videoId;
  const startPayload = referralCode
    ? `vid_${cleanVideoId}_${cleanPlatform}_ref_${referralCode}`
    : `vid_${cleanVideoId}_${cleanPlatform}_${niche}`;

  // Telegram deep-link payload must be alphanumeric + underscores, max 64 chars
  const sanitizedPayload = startPayload.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64);
  return `https://t.me/${botUsername}?start=${sanitizedPayload}`;
}
