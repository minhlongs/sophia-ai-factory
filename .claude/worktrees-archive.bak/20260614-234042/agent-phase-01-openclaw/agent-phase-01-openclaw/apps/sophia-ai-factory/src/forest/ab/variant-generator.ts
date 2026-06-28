/**
 * Variant Generator — Generate A/B caption + thumbnail prompt pairs
 *
 * Uses BYOK OpenRouter key to call LLM and produce 2 distinct caption variants
 * for a given offer title/description. Thumbnail prompt variants are also generated
 * for use with the image generation pipeline.
 *
 * YAGNI: 2 variants only (A vs B). Extend to N only when PM requests.
 *
 * @module forest/ab/variant-generator
 */

import { z } from 'zod';
import { logger } from '@/seed/utils/logger-utility';

// ---------------------------------------------------------------------------
// Input / Output schemas
// ---------------------------------------------------------------------------

export const VariantGeneratorInputSchema = z.object({
  /** Original offer title or caption to vary. */
  originalCaption: z.string().min(1).max(500),
  /** Optional short description for more context. */
  offerDescription: z.string().max(1000).optional(),
  /** BYOK OpenRouter API key. If absent, returns deterministic fallback variants. */
  byokOpenRouterKey: z.string().optional(),
  /** Target language for captions (BCP-47). Defaults to 'en'. */
  locale: z.enum(['en', 'vi']).default('en'),
});

export type VariantGeneratorInput = z.infer<typeof VariantGeneratorInputSchema>;

export interface GeneratedVariants {
  variantACaption: string;
  variantBCaption: string;
  variantAThumbPrompt: string;
  variantBThumbPrompt: string;
  /** True when LLM was called; false when fallback deterministic variants used. */
  usedLlm: boolean;
}

// ---------------------------------------------------------------------------
// LLM response schema (strict parsing)
// ---------------------------------------------------------------------------

const LlmResponseSchema = z.object({
  variant_a_caption: z.string().min(1).max(500),
  variant_b_caption: z.string().min(1).max(500),
  variant_a_thumb_prompt: z.string().min(1).max(300),
  variant_b_thumb_prompt: z.string().min(1).max(300),
});

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const LLM_MODEL = 'openai/gpt-4o-mini';

// ---------------------------------------------------------------------------
// Core generator
// ---------------------------------------------------------------------------

/**
 * Generate A/B caption and thumbnail prompt variants for an offer.
 *
 * Falls back to deterministic variants when:
 * - No BYOK key provided
 * - LLM call fails
 * - Response fails schema validation
 */
export async function generateVariants(
  input: VariantGeneratorInput,
): Promise<GeneratedVariants> {
  const parsed = VariantGeneratorInputSchema.parse(input);

  if (!parsed.byokOpenRouterKey) {
    logger.info('[variant-generator] no BYOK key — using deterministic fallback');
    return buildFallback(parsed.originalCaption);
  }

  try {
    const variants = await callLlm(parsed);
    return { ...variants, usedLlm: true };
  } catch (err) {
    logger.warn('[variant-generator] LLM call failed, using fallback', {
      error: err instanceof Error ? err.message : String(err),
    });
    return buildFallback(parsed.originalCaption);
  }
}

// ---------------------------------------------------------------------------
// LLM call
// ---------------------------------------------------------------------------

async function callLlm(input: VariantGeneratorInput): Promise<Omit<GeneratedVariants, 'usedLlm'>> {
  const langInstruction =
    input.locale === 'vi'
      ? 'Write captions in Vietnamese.'
      : 'Write captions in English.';

  const systemPrompt = `You are a conversion copywriter specializing in short-form video captions.
Generate exactly 2 variants (A and B) of a title/caption that test different hooks or angles.
Variant A = original angle (curiosity/problem). Variant B = contrasting angle (result/benefit).
Also generate a thumbnail visual prompt for each variant — concise, vivid, 1 sentence.
${langInstruction}
Return ONLY valid JSON with keys: variant_a_caption, variant_b_caption, variant_a_thumb_prompt, variant_b_thumb_prompt.`;

  const userContent = `Original caption: "${input.originalCaption}"${
    input.offerDescription ? `\nOffer description: "${input.offerDescription}"` : ''
  }`;

  const resp = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.byokOpenRouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://sophia.agencyos.network',
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.8,
      max_tokens: 512,
      response_format: { type: 'json_object' },
    }),
  });

  if (!resp.ok) {
    throw new Error(`OpenRouter ${resp.status}: ${await resp.text()}`);
  }

  const body = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty LLM response');

  const parsed = LlmResponseSchema.parse(JSON.parse(content));

  return {
    variantACaption: parsed.variant_a_caption,
    variantBCaption: parsed.variant_b_caption,
    variantAThumbPrompt: parsed.variant_a_thumb_prompt,
    variantBThumbPrompt: parsed.variant_b_thumb_prompt,
  };
}

// ---------------------------------------------------------------------------
// Deterministic fallback (no LLM key required)
// ---------------------------------------------------------------------------

function buildFallback(original: string): GeneratedVariants {
  const trimmed = original.trim();
  return {
    variantACaption: trimmed,
    variantBCaption: `${trimmed} — See results inside`,
    variantAThumbPrompt: `Eye-catching thumbnail for: ${trimmed.slice(0, 80)}`,
    variantBThumbPrompt: `Results-focused thumbnail showing success for: ${trimmed.slice(0, 80)}`,
    usedLlm: false,
  };
}
