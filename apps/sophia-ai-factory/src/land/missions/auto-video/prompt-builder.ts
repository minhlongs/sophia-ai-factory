/**
 * Auto Video Mission Script & Prompt Generator Helpers
 *
 * Layer: land
 *
 * @module land/missions/auto-video/prompt-builder
 */

import { generateSeoScript, SeoScriptConfigurationError } from '@/land/scripts/generate-seo-script';
import { translateScript, TranslateConfigurationError } from '@/land/i18n/translate-script';
import { buildVideoDescription } from '@/land/affiliates/video-description-injector';
import { AutoVideoMissionError, type AutoVideoMissionInput, type AutoVideoMissionResult } from './types';

/**
 * Step 1 & 2: SEO Script Generation and optional translation.
 */
export async function buildMissionScript(
  input: AutoVideoMissionInput,
  missionId: string,
  primaryLanguage: 'en' | 'vi',
): Promise<{
  primary: AutoVideoMissionResult['script']['primary'];
  secondary?: AutoVideoMissionResult['script']['secondary'];
}> {
  let scriptResult;
  try {
    scriptResult = await generateSeoScript({
      userId: input.userId,
      topic: input.topic,
      keywords: input.keywords,
      language: primaryLanguage,
    });
  } catch (err) {
    const code = err instanceof SeoScriptConfigurationError && err.code === 'BYOK_REQUIRED' ? 'BYOK_REQUIRED' : 'SCRIPT_FAILED';
    const msg = err instanceof Error ? err.message : 'SEO script generation failed';
    throw new AutoVideoMissionError(code, msg, missionId);
  }

  let secondary: AutoVideoMissionResult['script']['secondary'];
  if (input.secondaryLanguage && input.secondaryLanguage !== primaryLanguage) {
    try {
      const t = await translateScript({
        userId: input.userId,
        text: scriptResult.script,
        fromLang: primaryLanguage,
        toLang: input.secondaryLanguage,
        tone: 'natural',
      });
      secondary = { language: input.secondaryLanguage, body: t.translated };
    } catch (err) {
      const code = err instanceof TranslateConfigurationError && err.code === 'BYOK_REQUIRED' ? 'BYOK_REQUIRED' : 'TRANSLATE_FAILED';
      const msg = err instanceof Error ? err.message : 'translate step failed';
      throw new AutoVideoMissionError(code, msg, missionId);
    }
  }

  return {
    primary: {
      language: primaryLanguage,
      body: scriptResult.script,
      seoScore: scriptResult.seoScore,
      suggestedTitles: scriptResult.suggestedTitles,
      wordCount: scriptResult.wordCount,
    },
    secondary,
  };
}

/**
 * Step 3: Affiliate-enriched description generation.
 */
export async function buildMissionDescription(
  input: AutoVideoMissionInput,
  baseBody: string,
  missionId: string,
): Promise<{ body: string; affiliateCount: number }> {
  try {
    const descriptionResult = await buildVideoDescription({
      userId: input.userId,
      baseBody,
      nicheHint: input.nicheHint,
      maxLinks: input.maxAffiliateLinks,
    });
    return {
      body: descriptionResult.description,
      affiliateCount: descriptionResult.affiliateCount,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'description build failed';
    throw new AutoVideoMissionError('DESCRIPTION_FAILED', msg, missionId);
  }
}
