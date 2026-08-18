/**
 * Content Variant Generator — Generate A/B variants for caption/hook/CTA experiments
 *
 * Generalises the thumbnail-only variant-generator to support any ContentType.
 * Uses BYOK OpenRouter key via resilientChatCompletion when available,
 * deterministic fallback otherwise.
 *
 * @module forest/ab/content-variant-generator
 */

import { z } from 'zod';
import { logger } from '@/seed/utils/logger-utility';
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';
import type { ContentType } from './ab-types';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export interface ContentVariants {
  contentType: ContentType;
  variantA: string;
  variantB: string;
  usedLlm: boolean;
}

const LLM_VARIANT_SCHEMA = z.object({
  variant_a: z.string().min(1),
  variant_b: z.string().min(1),
});

export interface ContentVariantInput {
  contentType: ContentType;
  original: string;
  context?: string;
  byokOpenRouterKey?: string;
}

// ---------------------------------------------------------------------------
// Prompt builders (per content type)
// ---------------------------------------------------------------------------

function buildPrompt(
  contentType: ContentType,
  original: string,
  context?: string,
): string {
  const ctx = context ? `\nContext: ${context}` : '';
  const typeLabel: Record<ContentType, string> = {
    thumbnail: 'thumbnail title',
    caption: 'social media caption',
    hook: 'video hook / opening line',
    cta: 'call-to-action text',
  };

  return [
    `You are an A/B testing copywriter for a YouTube automation SaaS.`,
    `Generate exactly 2 distinct ${typeLabel[contentType]} variants for an A/B test.`,
    '',
    `Original: "${original}"${ctx}`,
    '',
    `Return JSON: { "variant_a": "...", "variant_b": "..." }`,
    `Rules: variant A should be engaging and curiosity-driven. Variant B should be results/social-proof-driven. Both must be under 150 characters.`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate two A/B content variants for any content type.
 *
 * @param input - Content variant input (contentType, original, context, BYOK key)
 * @returns     - Two variants plus whether LLM was used
 */
export async function generateContentVariants(
  input: ContentVariantInput,
): Promise<ContentVariants> {
  const { contentType, original, context, byokOpenRouterKey } = input;
  const prompt = buildPrompt(contentType, original, context);

  try {
    const response = await resilientChatCompletion(prompt, {
      openRouterKey: byokOpenRouterKey ?? null,
      anthropicKey: undefined,
      enableFallback: false,
      model: 'openai/gpt-4o-mini',
    });

    const parsed = JSON.parse(response);
    const validated = LLM_VARIANT_SCHEMA.parse(parsed);

    return {
      contentType,
      variantA: validated.variant_a,
      variantB: validated.variant_b,
      usedLlm: true,
    };
  } catch (err) {
    logger.warn('[content-variant-generator] LLM call failed, using fallback', {
      contentType,
      error: err instanceof Error ? err.message : String(err),
    });
    return buildFallback(contentType, original, context);
  }
}

// ---------------------------------------------------------------------------
// Deterministic fallback (no LLM required)
// ---------------------------------------------------------------------------

function buildFallback(contentType: ContentType, original: string, _context?: string): ContentVariants {
  const trimmed = original.trim();
  const suffixes: Record<ContentType, [string, string]> = {
    thumbnail: [trimmed, `${trimmed} — See results inside`],
    caption: [trimmed, `${trimmed} ✨ Limited spots available`],
    hook: [trimmed, `Wait for it — ${trimmed.toLowerCase()}`],
    cta: [trimmed, `${trimmed} — Start free today`],
  };
  const [a, b] = suffixes[contentType];
  return { contentType, variantA: a, variantB: b, usedLlm: false };
}
