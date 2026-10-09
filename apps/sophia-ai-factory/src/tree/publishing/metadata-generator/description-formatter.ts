/**
 * @file description-formatter.ts
 * @description Platform-compliant SEO description formatter with guaranteed attribution preservation.
 * @layer tree
 */

import type { ApacLanguage } from '@/seed/types/apac-syndication';
import { PLATFORM_LIMITS } from './hook-templates';
import type { FormatSeoDescriptionOptions } from './types';

export const CTA_COPY_BY_LANGUAGE: Record<ApacLanguage, { fun: string; tg: string; tagHeader: string }> = {
  vi: {
    fun: '🚀 Khám phá giải pháp tự động hóa video AI cùng Sophia Factory:',
    tg: '💬 Nhận video mẫu miễn phí & tư vấn tức thì qua Telegram Bot:',
    tagHeader: 'Từ khóa:',
  },
  en: {
    fun: '🚀 Deploy your 24/7 autonomous video agent with Sophia Factory:',
    tg: '💬 Test live interactive video demo on Telegram:',
    tagHeader: 'Tags:',
  },
  ja: {
    fun: '🚀 Sophia AI Factoryで動画制作を24時間完全自動化:',
    tg: '💬 Telegramで今すぐ無料デモ動画を体験:',
    tagHeader: '関連タグ:',
  },
  ko: {
    fun: '🚀 Sophia AI Factory로 24시간 자동화 비디오 파이프라인 구축:',
    tg: '💬 텔레그램 봇으로 실시간 무료 샘플 영상 받아보기:',
    tagHeader: '태그:',
  },
  th: {
    fun: '🚀 สร้างระบบผลิตวิดีโอ AI อัตโนมัติ 24 ชม. กับ Sophia Factory:',
    tg: '💬 ทดลองรับตัวอย่างวิดีโอฟรีผ่าน Telegram Bot ทันที:',
    tagHeader: 'แท็ก:',
  },
};

/**
 * Helper to prune secondary elements (hashtags, referral notes) when the attribution
 * block itself is exceptionally close to or exceeds maxDescriptionLength.
 * GUARANTEE: trackedFunnelUrl and telegramDeepLink are 100% preserved.
 */
export function pruneAttributionBlock(
  parts: string[],
  trackedFunnelUrl: string,
  telegramDeepLink: string,
  maxDescriptionLength: number,
): string {
  const mandatoryBlock = `👉 ${trackedFunnelUrl}\n🤖 ${telegramDeepLink}`;
  if (mandatoryBlock.length >= maxDescriptionLength) {
    return mandatoryBlock;
  }

  const retained = [...parts];
  while (retained.length > 0 && retained.join('\n\n').length > maxDescriptionLength) {
    let nonLinkIdx = -1;
    for (let i = retained.length - 1; i >= 0; i--) {
      if (!retained[i].includes(trackedFunnelUrl) && !retained[i].includes(telegramDeepLink)) {
        nonLinkIdx = i;
        break;
      }
    }
    if (nonLinkIdx >= 0) {
      retained.splice(nonLinkIdx, 1);
    } else {
      break;
    }
  }

  const result = retained.join('\n\n');
  if (
    result.length <= maxDescriptionLength &&
    result.includes(trackedFunnelUrl) &&
    result.includes(telegramDeepLink)
  ) {
    return result;
  }

  return mandatoryBlock;
}

/**
 * Format SEO description with strict length limit compliance and guaranteed attribution preservation.
 */
export function formatSeoDescription(options: FormatSeoDescriptionOptions): string {
  const {
    platform,
    language,
    rawTitle,
    keyTakeaways = [],
    trackedFunnelUrl,
    telegramDeepLink,
    hashtags,
    referralCode,
    maxDescriptionLength = PLATFORM_LIMITS[platform]?.maxDescriptionLength ?? 2200,
  } = options;

  const cta = CTA_COPY_BY_LANGUAGE[language] ?? CTA_COPY_BY_LANGUAGE.en;
  const hashtagsFormatted = hashtags.join(' ');
  const takeawaysBlock =
    keyTakeaways.length > 0
      ? `📌 Key Takeaways:\n${keyTakeaways.map((k) => `• ${k}`).join('\n')}`
      : '';

  let bodyParts: string[] = [];
  let attributionParts: string[] = [];

  switch (platform) {
    case 'youtube_shorts': {
      bodyParts = [rawTitle, takeawaysBlock].filter(Boolean);
      attributionParts = [
        `${cta.fun}\n👉 ${trackedFunnelUrl}`,
        `${cta.tg}\n🤖 ${telegramDeepLink}`,
        `Use referral code ${referralCode || 'SOLO100'} for special tier bonus!`,
        `${cta.tagHeader}\n${hashtagsFormatted}`,
      ].filter(Boolean);
      break;
    }

    case 'tiktok': {
      bodyParts = [`${rawTitle} 👀`];
      if (takeawaysBlock) {
        bodyParts.push(takeawaysBlock);
      }
      attributionParts = [
        `${cta.fun} Link in bio hoặc click: ${trackedFunnelUrl}`,
        `💬 Demo nhanh qua Telegram: ${telegramDeepLink}`,
        hashtagsFormatted,
      ].filter(Boolean);
      break;
    }

    case 'instagram_reels': {
      bodyParts = [`✨ ${rawTitle}`, takeawaysBlock].filter(Boolean);
      attributionParts = [
        `🔗 Truy cập ngay: ${trackedFunnelUrl}`,
        `💬 Trải nghiệm demo bot: ${telegramDeepLink}`,
        '---',
        hashtagsFormatted,
      ].filter(Boolean);
      break;
    }

    case 'facebook_reels': {
      bodyParts = [
        `🔥 ${rawTitle}`,
        takeawaysBlock,
        '👉 Bình luận "AI" hoặc nhấp vào liên kết bên dưới để nhận hướng dẫn chi tiết:',
      ].filter(Boolean);
      attributionParts = [
        `🌐 Link chi tiết: ${trackedFunnelUrl}`,
        `📲 Nhận mẫu qua Telegram: ${telegramDeepLink}`,
        hashtagsFormatted,
      ].filter(Boolean);
      break;
    }
  }

  const bodyText = bodyParts.join('\n\n').trim();
  const trailingAttributionBlock = attributionParts.join('\n\n').trim();

  // If no body text is available, return trailing attribution block
  if (!bodyText) {
    if (trailingAttributionBlock.length <= maxDescriptionLength) {
      return trailingAttributionBlock;
    }
    return pruneAttributionBlock(attributionParts, trackedFunnelUrl, telegramDeepLink, maxDescriptionLength);
  }

  const fullDescription = `${bodyText}\n\n${trailingAttributionBlock}`;
  if (fullDescription.length <= maxDescriptionLength) {
    return fullDescription;
  }

  // Truncation required: truncate the body text while preserving trailing attribution block intact
  const separator = '\n\n';
  const ellipsis = '...';
  const overhead = ellipsis.length + separator.length; // 5 characters
  const availableBodyLength = maxDescriptionLength - trailingAttributionBlock.length - overhead;

  if (availableBodyLength > 0) {
    const truncatedBody = bodyText.slice(0, availableBodyLength).trimEnd() + ellipsis;
    return `${truncatedBody}${separator}${trailingAttributionBlock}`;
  }

  // If body cannot fit at all, check if trailing attribution block fits
  if (trailingAttributionBlock.length <= maxDescriptionLength) {
    return trailingAttributionBlock;
  }

  // Extreme case: attribution block alone exceeds limit. Prune non-link parts while keeping links 100% intact.
  return pruneAttributionBlock(attributionParts, trackedFunnelUrl, telegramDeepLink, maxDescriptionLength);
}
