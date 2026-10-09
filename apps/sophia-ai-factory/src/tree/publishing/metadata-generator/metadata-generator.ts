/**
 * @file metadata-generator.ts
 * @description Unified viral metadata generator orchestrator.
 * @layer tree
 */

import type { ViralMetadataInput, ViralMetadataResult } from '@/seed/types/apac-syndication';
import { HOOK_TEMPLATES_BY_LANGUAGE, PLATFORM_LIMITS } from './hook-templates';
import { NICHE_HASHTAGS_BY_LANGUAGE, PLATFORM_SIGNATURE_TAGS } from './hashtags-and-tags';
import { buildTelegramDeepLink, buildTrackedFunnelUrl } from './url-builders';
import { generateThumbnailPromptSpec } from './thumbnail-spec';
import { formatSeoDescription } from './description-formatter';

/**
 * Generate fully compliant viral metadata (Hook title, SEO description, hashtags,
 * tracked URLs, and CTR thumbnail prompt) tailored for target language, platform, and niche.
 */
export function generateViralMetadata(input: ViralMetadataInput): ViralMetadataResult {
  const {
    topic,
    niche,
    targetPlatform,
    targetLanguage,
    targetMarket,
    hookArchetype = 'curiosity_gap',
    keyTakeaways = [],
    referralCode,
    customTelegramStart,
    funnelBaseUrl,
    videoJobId = `vid_${Date.now().toString(36)}`,
  } = input;

  const limits = PLATFORM_LIMITS[targetPlatform] ?? { maxTitleLength: 100, maxDescriptionLength: 2200 };

  // 1. Generate Localized Hook Title
  const languageTemplates =
    HOOK_TEMPLATES_BY_LANGUAGE[targetLanguage] ?? HOOK_TEMPLATES_BY_LANGUAGE.en;
  const templateFn =
    languageTemplates[hookArchetype] ?? languageTemplates.curiosity_gap;
  const rawTitle = templateFn(topic);

  // Platform title constraints
  let hookTitle = rawTitle;
  if (targetPlatform === 'youtube_shorts') {
    const shortsTag = ' #Shorts';
    const maxBaseLen = limits.maxTitleLength - shortsTag.length;
    if (hookTitle.length > maxBaseLen) {
      hookTitle = hookTitle.slice(0, maxBaseLen - 3) + '...';
    }
    if (!hookTitle.includes('#Shorts')) {
      hookTitle = `${hookTitle}${shortsTag}`;
    }
  } else {
    if (hookTitle.length > limits.maxTitleLength) {
      hookTitle = hookTitle.slice(0, limits.maxTitleLength - 3) + '...';
    }
  }

  // 2. Build Tracked Funnel & Telegram Deep Link
  const trackedFunnelUrl = buildTrackedFunnelUrl({
    baseUrl: funnelBaseUrl,
    platform: targetPlatform,
    niche,
    hookArchetype,
    videoId: videoJobId,
    referralCode,
  });

  const telegramDeepLink = buildTelegramDeepLink({
    videoId: videoJobId,
    platform: targetPlatform,
    niche,
    referralCode,
    customStart: customTelegramStart,
  });

  // 3. Curate Localized Trending Hashtags
  const langHashtags =
    NICHE_HASHTAGS_BY_LANGUAGE[targetLanguage] ?? NICHE_HASHTAGS_BY_LANGUAGE.en;
  const nicheTags = langHashtags[niche] ?? langHashtags.default ?? ['#SophiaAI', '#AIAutomation'];
  const platformTags = PLATFORM_SIGNATURE_TAGS[targetPlatform] ?? [];

  // Deduplicate and combine
  const combinedHashtags = Array.from(new Set([...platformTags, ...nicheTags]));

  // 4. Construct Platform-Compliant SEO Description with Guaranteed Link Preservation
  const seoDescription = formatSeoDescription({
    platform: targetPlatform,
    language: targetLanguage,
    rawTitle,
    keyTakeaways,
    trackedFunnelUrl,
    telegramDeepLink,
    hashtags: combinedHashtags,
    referralCode,
    maxDescriptionLength: limits.maxDescriptionLength,
  });

  // 5. Generate Thumbnail Specification
  const thumbnailSpec = generateThumbnailPromptSpec({
    topic,
    language: targetLanguage,
    platform: targetPlatform,
    hookHeadline: rawTitle,
  });

  return {
    hookTitle,
    seoDescription,
    hashtags: combinedHashtags,
    thumbnailPrompt: thumbnailSpec.prompt,
    thumbnailSpec,
    trackedFunnelUrl,
    telegramDeepLink,
    platform: targetPlatform,
    language: targetLanguage,
    targetMarket,
    charCount: {
      title: hookTitle.length,
      description: seoDescription.length,
    },
    isCompliant:
      hookTitle.length <= limits.maxTitleLength &&
      seoDescription.length <= limits.maxDescriptionLength,
  };
}
