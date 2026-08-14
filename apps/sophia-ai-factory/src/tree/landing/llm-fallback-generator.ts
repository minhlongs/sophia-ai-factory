/**
 * LLM Fallback Generator — generates bilingual landing page content for unknown niches.
 *
 * Flow: D1 miss → KV cache miss → OpenRouter LLM call → Zod validate → KV cache → return.
 * Uses admin-owned BYOK OpenRouter key (resolved by caller via resolveUserApiKey).
 *
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

const LLM_TIMEOUT_MS = 20000;
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

const _SYSTEM_PROMPT = `You are a bilingual (Vietnamese + English) content writer for an AI video generation SaaS platform called Sophia AI Factory.
Your job: create marketing landing page content for a specific business niche.

Rules:
- Write persuasive, benefit-driven copy that appeals to non-technical business owners
- Each section must have BOTH English (en) and Vietnamese (vi) versions
- Features: 3-6 items, each with an icon name, title, and description in both languages
- FAQ: 3-5 items, each with question and answer in both languages
- Meta title: under 70 characters
- Meta description: under 160 characters, compelling SEO copy
- Return ONLY valid JSON — no markdown fences, no explanations`;

function buildUserPrompt(nicheSlug: string): string {
  const label = NICHE_LABELS[nicheSlug as NicheSlug];
  const nicheName = label ? `${label.en} / ${label.vi}` : nicheSlug.replace(/-/g, ' ');

  return `Create a bilingual landing page for the niche: ${nicheName} (slug: ${nicheSlug}).

The page promotes using AI-generated videos for this specific industry.

Return a JSON object with this exact structure:
{
  "heroTitleEn": "...",
  "heroTitleVi": "...",
  "heroSubEn": "...",
  "heroSubVi": "...",
  "features": [
    { "icon": "icon-name", "title_en": "...", "title_vi": "...", "desc_en": "...", "desc_vi": "..." }
  ],
  "faq": [
    { "question_en": "...", "question_vi": "...", "answer_en": "...", "answer_vi": "..." }
  ],
  "metaTitleEn": "...",
  "metaTitleVi": "...",
  "metaDescEn": "...",
  "metaDescVi": "..."
}`;
}

/**
 * Strip markdown code fences from LLM response if present.
 */
function stripMarkdownFences(raw: string): string {
  let cleaned = raw.trim();
  // Remove opening ```json or ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '');
  }
  // Remove closing ```
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

/**
 * Generate bilingual landing page content for a niche via OpenRouter LLM.
 *
 * First checks D1 (curated content), then KV cache, then calls LLM.
 * Generated content is cached in KV for 7 days.
 *
 * @param nicheSlug - The niche slug to generate content for.
 * @param apiKey - Optional OpenRouter API key. If not provided, falls back to
 *   process.env.OPENROUTER_API_KEY. Callers should resolve admin BYOK key via
 *   resolveUserApiKey(adminUserId, 'openrouter', process.env.OPENROUTER_API_KEY).
 * @returns Generated landing content with all bilingual fields.
 * @throws If all sources fail (D1 miss + KV miss + LLM error).
 */
export async function generateLandingPageContent(
  nicheSlug: string,
  apiKey?: string,
): Promise<GeneratedLandingContent> {
  // 1. Check D1 first — curated content always wins
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

  // 2. Check KV cache
  const cached = await getCachedLandingPage(nicheSlug);
  if (cached) return cached;

  // 3. LLM generation
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

    // Resolve niche label from NICHE_LABELS or derive from slug
    const label = NICHE_LABELS[nicheSlug as NicheSlug];
    const nicheLabel = label
      ? `${label.en} / ${label.vi}`
      : nicheSlug.replace(/-/g, ' ');

    // 4. Cache in KV
    await setCachedLandingPage(nicheSlug, nicheLabel, validated);

    logger.info('[LLMFallback] Landing page content generated and cached', { nicheSlug });
    return validated;
  } catch (err) {
    const error = toError(err);
    logger.error('[LLMFallback] Generation failed', { nicheSlug, error: error.message });
    throw new Error(`Failed to generate landing page for "${nicheSlug}": ${error.message}`);
  }
}

/**
 * Promise with timeout. Rejects if the promise doesn't resolve within ms.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeout]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
