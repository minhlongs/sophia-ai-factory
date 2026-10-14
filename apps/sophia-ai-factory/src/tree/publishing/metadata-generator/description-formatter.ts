/**
 * @file description-formatter.ts
 * @description Platform-compliant SEO description formatter with guaranteed attribution preservation.
 * @layer tree
 */

import { PLATFORM_LIMITS } from './hook-templates';
import type { FormatSeoDescriptionOptions } from './types';
import {
  CTA_COPY_BY_LANGUAGE,
  pruneAttributionBlock,
} from './description-formatter-helpers';

export {
  CTA_COPY_BY_LANGUAGE,
  pruneAttributionBlock,
} from './description-formatter-helpers';

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
