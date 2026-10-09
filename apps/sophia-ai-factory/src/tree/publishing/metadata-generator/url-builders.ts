/**
 * @file url-builders.ts
 * @description Conversion tracking funnel URL and Telegram deep link builders.
 * @layer tree
 */

import type { PlatformType, ViralHookArchetype } from '@/seed/types/apac-syndication';

export function buildTrackedFunnelUrl(params: {
  baseUrl?: string;
  platform: PlatformType;
  niche: string;
  hookArchetype: ViralHookArchetype;
  videoId: string;
  referralCode?: string;
}): string {
  const {
    baseUrl = 'https://sophia.agencyos.network',
    platform,
    niche,
    hookArchetype,
    videoId,
    referralCode,
  } = params;

  try {
    const url = new URL(baseUrl);
    url.searchParams.set('utm_source', platform);
    url.searchParams.set('utm_medium', 'short_video');
    url.searchParams.set('utm_campaign', niche.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
    url.searchParams.set('utm_content', `${hookArchetype}_${videoId}`);

    if (referralCode && referralCode.trim().length > 0) {
      url.searchParams.set('ref', referralCode.trim());
    }

    return url.toString();
  } catch {
    const query = `utm_source=${platform}&utm_medium=short_video&utm_campaign=${encodeURIComponent(niche)}&utm_content=${hookArchetype}_${videoId}${referralCode ? `&ref=${encodeURIComponent(referralCode)}` : ''}`;
    return `${baseUrl}?${query}`;
  }
}

export function buildTelegramDeepLink(params: {
  botUsername?: string;
  videoId: string;
  platform: PlatformType;
  niche: string;
  referralCode?: string;
  customStart?: string;
}): string {
  const {
    botUsername = 'Sophia_Bbot',
    videoId,
    platform,
    niche,
    referralCode,
    customStart,
  } = params;

  if (customStart && customStart.trim().length > 0) {
    return `https://t.me/${botUsername}?start=${encodeURIComponent(customStart.trim())}`;
  }

  const platformCodeMap: Record<PlatformType, string> = {
    youtube_shorts: 'yt',
    tiktok: 'tt',
    instagram_reels: 'ig',
    facebook_reels: 'fb',
  };

  const code = platformCodeMap[platform] ?? 'so';
  const cleanId = videoId.replace(/^vid_/, '').slice(0, 16);
  const cleanNiche = niche.slice(0, 12).replace(/[^a-zA-Z0-9]/g, '');

  const payload = referralCode
    ? `v_${cleanId}_${code}_${referralCode.slice(0, 16)}`
    : `v_${cleanId}_${code}_${cleanNiche}`;

  const sanitized = payload.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64);
  return `https://t.me/${botUsername}?start=${sanitized}`;
}
