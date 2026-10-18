/**
 * Platform-specific caption string builders
 * Layer: Forest
 */

import type { ViralPlatform } from '@/seed/types/growth';

export interface CaptionBuilderParams {
  platform: ViralPlatform;
  videoTitle: string;
  scriptText?: string;
  trackedUrl: string;
  telegramDeepLink: string;
  tags: string;
}

function buildTwitterCaption(videoTitle: string, trackedUrl: string, tags: string): string {
  const firstTag = tags.split(' ')[0] || '#AI';
  const suffixWithTag = `\n\nAutomate 100% of your short-form funnel:\n${trackedUrl}\n${firstTag}`;
  const suffixWithoutTag = `\n\nAutomate 100% of your short-form funnel:\n${trackedUrl}`;

  let suffix = suffixWithTag;
  let availableForTitle = 280 - suffix.length;

  if (availableForTitle < 15) {
    suffix = suffixWithoutTag;
    availableForTitle = 280 - suffix.length;
  }

  let titlePart = '';
  if (availableForTitle > 3) {
    titlePart = videoTitle.length > availableForTitle
      ? `${videoTitle.slice(0, availableForTitle - 3)}...`
      : videoTitle;
  } else if (availableForTitle > 0) {
    titlePart = videoTitle.slice(0, availableForTitle);
  }

  const caption = `${titlePart}${suffix}`;
  return caption.length > 280 ? caption.slice(0, 280) : caption;
}

export function buildPlatformCaptionText({
  platform,
  videoTitle,
  scriptText,
  trackedUrl,
  telegramDeepLink,
  tags,
}: CaptionBuilderParams): string {
  switch (platform) {
    case 'tiktok': {
      const leadIn = scriptText?.slice(0, 120) || videoTitle.slice(0, 120);
      const caption = `${leadIn}\n\n👉 Test our 24/7 autonomous video agent: link in bio or tap Telegram below!\n💬 Telegram Demo: ${telegramDeepLink}\n\n${tags} #FYP #ViralVideo`;
      return caption.slice(0, 2200);
    }

    case 'youtube_shorts': {
      return `${videoTitle} #Shorts\n\n${scriptText || ''}\n\n` +
        `🚀 Deploy Your Autonomous Video AI:\n${trackedUrl}\n\n` +
        `💬 Interactive Telegram Bot Demo (Instant Video Sample):\n${telegramDeepLink}\n\n` +
        `Use code SOLO100 for exclusive discount!\n\n` +
        `${tags} #Shorts #AIAutomation #SophiaAIFactory`;
    }

    case 'twitter':
    case 'x': {
      return buildTwitterCaption(videoTitle, trackedUrl, tags);
    }

    case 'instagram_reels': {
      const leadIn = scriptText?.slice(0, 150) || videoTitle.slice(0, 150);
      const caption = `${leadIn}\n\n` +
        `🚀 Deploy your autonomous AI video system:\n${trackedUrl}\n\n` +
        `💬 Interactive Telegram Bot Demo (Instant Video Sample):\n${telegramDeepLink}\n\n` +
        `${tags} #ReelsInstagram #ReelsViral #InstaReels #SophiaAI`;
      return caption.slice(0, 2200);
    }

    case 'facebook_reels': {
      const leadIn = scriptText?.slice(0, 150) || videoTitle.slice(0, 150);
      const caption = `${leadIn}\n\n` +
        `🔥 Xem chi tiết hệ thống video AI tự động 24/7:\n${trackedUrl}\n\n` +
        `📲 Trải nghiệm bot demo tức thì trên Telegram:\n${telegramDeepLink}\n\n` +
        `${tags} #FBReels #ReelsFacebook #VideoTrending #SophiaAI`;
      return caption.slice(0, 2200);
    }

    default: {
      return `${videoTitle}\n\n${trackedUrl}\n${telegramDeepLink}\n${tags}`;
    }
  }
}
