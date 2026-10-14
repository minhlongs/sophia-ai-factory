/**
 * LLM Fallback Generator — generates bilingual landing page content for unknown niches.
 *
 * Flow: D1 miss → KV cache miss → OpenRouter LLM call → Zod validate → KV cache → return.
 * @module tree/landing/llm-fallback-generator
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';
import { getBySlug } from '@/seed/db/repositories/landing-pages-repo';
import {
  getCachedLandingPage,
  setCachedLandingPage,
} from '@/seed/kv/landing-cache-ops';
import {
  GeneratedLandingContentSchema,
  type GeneratedLandingContent,
} from '@/seed/types/landing-page-types';
import { NICHE_LABELS, type NicheSlug } from '@/seed/config/niche-list';
import {
  LLM_TIMEOUT_MS,
  DEFAULT_MODEL,
  buildUserPrompt,
  stripMarkdownFences,
  withTimeout,
} from './llm-fallback-helpers';

/**
 * Generate bilingual landing page content for a niche via OpenRouter LLM.
 *
 * First checks D1 (curated content), then KV cache, then calls LLM.
 * Generated content is cached in KV for 7 days.
 */
export async function generateLandingPageContent(
  nicheSlug: string,
  apiKey?: string,
): Promise<GeneratedLandingContent> {
  const d1Page = await getBySlug(nicheSlug);
  if (d1Page) {
    return {
      heroTitleEn: d1Page.heroTitleEn ?? '',
      heroTitleVi: d1Page.heroTitleVi ?? '',
      heroSubEn: d1Page.heroSubEn ?? '',
      heroSubVi: d1Page.heroSubVi ?? '',
      features: d1Page.features,
      faq: d1Page.faq,
      metaTitleEn: d1Page.metaTitleEn ?? '',
      metaTitleVi: d1Page.metaTitleVi ?? '',
      metaDescEn: d1Page.metaDescEn ?? '',
      metaDescVi: d1Page.metaDescVi ?? '',
    };
  }

  const cached = await getCachedLandingPage(nicheSlug);
  if (cached) return cached;

  const resolvedKey = apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!resolvedKey) {
    throw new Error(
      `No OpenRouter API key available for landing page generation (niche: ${nicheSlug}). ` +
        'Provide an apiKey or set OPENROUTER_API_KEY in environment.',
    );
  }

  logger.info('[LLMFallback] Generating landing page content', { nicheSlug });

  try {
    const rawResponse = await withTimeout(
      resilientChatCompletion(buildUserPrompt(nicheSlug), {
        openRouterKey: resolvedKey,
        model: DEFAULT_MODEL,
      }),
      LLM_TIMEOUT_MS,
    );

    const cleaned = stripMarkdownFences(rawResponse);
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(`LLM response is not valid JSON: ${cleaned.slice(0, 200)}`);
    }

    const validated = GeneratedLandingContentSchema.parse(parsed);

    const label = NICHE_LABELS[nicheSlug as NicheSlug];
    const nicheLabel = label
      ? `${label.en} / ${label.vi}`
      : nicheSlug.replace(/-/g, ' ');

    await setCachedLandingPage(nicheSlug, nicheLabel, validated);

    logger.info('[LLMFallback] Landing page content generated and cached', { nicheSlug });
    return validated;
  } catch (err) {
    const error = toError(err);
    logger.error('[LLMFallback] Generation failed', { nicheSlug, error: error.message });
    throw new Error(`Failed to generate landing page for "${nicheSlug}": ${error.message}`);
  }
}
