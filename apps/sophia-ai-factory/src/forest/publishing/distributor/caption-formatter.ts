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

  let caption = '';

  switch (platform) {
    case 'tiktok': {
      const leadIn = scriptText?.slice(0, 120) || videoTitle.slice(0, 120);
      caption = `${leadIn}\n\n👉 Test our 24/7 autonomous video agent: link in bio or tap Telegram below!\n💬 Telegram Demo: ${telegramDeepLink}\n\n${tags} #FYP #ViralVideo`;
      if (caption.length > 2200) {
        caption = caption.slice(0, 2200);
      }
      break;
    }

    case 'youtube_shorts': {
      caption = `${videoTitle} #Shorts\n\n${scriptText || ''}\n\n` +
        `🚀 Deploy Your Autonomous Video AI:\n${trackedUrl}\n\n` +
        `💬 Interactive Telegram Bot Demo (Instant Video Sample):\n${telegramDeepLink}\n\n` +
        `Use code SOLO100 for exclusive discount!\n\n` +
        `${tags} #Shorts #AIAutomation #SophiaAIFactory`;
      break;
    }

    case 'twitter':
    case 'x': {
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

      caption = `${titlePart}${suffix}`;
      if (caption.length > 280) {
        caption = caption.slice(0, 280);
      }
      break;
    }

    case 'instagram_reels': {
      const leadIn = scriptText?.slice(0, 150) || videoTitle.slice(0, 150);
      caption = `${leadIn}\n\n` +
        `🚀 Deploy your autonomous AI video system:\n${trackedUrl}\n\n` +
        `💬 Interactive Telegram Bot Demo (Instant Video Sample):\n${telegramDeepLink}\n\n` +
        `${tags} #ReelsInstagram #ReelsViral #InstaReels #SophiaAI`;
      if (caption.length > 2200) {
        caption = caption.slice(0, 2200);
      }
      break;
    }

    case 'facebook_reels': {
      const leadIn = scriptText?.slice(0, 150) || videoTitle.slice(0, 150);
      caption = `${leadIn}\n\n` +
        `🔥 Xem chi tiết hệ thống video AI tự động 24/7:\n${trackedUrl}\n\n` +
        `📲 Trải nghiệm bot demo tức thì trên Telegram:\n${telegramDeepLink}\n\n` +
        `${tags} #FBReels #ReelsFacebook #VideoTrending #SophiaAI`;
      if (caption.length > 2200) {
        caption = caption.slice(0, 2200);
      }
      break;
    }

    default: {
      caption = `${videoTitle}\n\n${trackedUrl}\n${telegramDeepLink}\n${tags}`;
      break;
    }
  }

  return { caption, trackedUrl, telegramDeepLink };
}
