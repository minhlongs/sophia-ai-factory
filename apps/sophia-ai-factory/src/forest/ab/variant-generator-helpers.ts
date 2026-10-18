/**
 * Schemas, types, LLM caller, and deterministic fallback for A/B Variant Generator
 *
 * @module forest/ab/variant-generator-helpers
 */

import { z } from 'zod';
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';

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

const LlmResponseSchema = z.object({
  variant_a_caption: z.string().min(1).max(500),
  variant_b_caption: z.string().min(1).max(500),
  variant_a_thumb_prompt: z.string().min(1).max(300),
  variant_b_thumb_prompt: z.string().min(1).max(300),
});

export async function callVariantLlm(
  input: VariantGeneratorInput,
): Promise<Omit<GeneratedVariants, 'usedLlm'>> {
  const langInstruction =
    input.locale === 'vi'
      ? 'Write captions in Vietnamese.'
      : 'Write captions in English.';

  const _systemPrompt = `You are a conversion copywriter specializing in short-form video captions.
Generate exactly 2 variants (A and B) of a title/caption that test different hooks or angles.
Variant A = original angle (curiosity/problem). Variant B = contrasting angle (result/benefit).
Also generate a thumbnail visual prompt for each variant — concise, vivid, 1 sentence.
${langInstruction}
Return ONLY valid JSON with keys: variant_a_caption, variant_b_caption, variant_a_thumb_prompt, variant_b_thumb_prompt.`;

  const userContent = `Original caption: "${input.originalCaption}"${
    input.offerDescription ? `\nOffer description: "${input.offerDescription}"` : ''
  }`;

  const content = await resilientChatCompletion(userContent, {
    openRouterKey: input.byokOpenRouterKey ?? null,
    anthropicKey: undefined,
    enableFallback: false,
    model: 'openai/gpt-4o-mini',
  });

  const parsed = LlmResponseSchema.parse(JSON.parse(content));

  return {
    variantACaption: parsed.variant_a_caption,
    variantBCaption: parsed.variant_b_caption,
    variantAThumbPrompt: parsed.variant_a_thumb_prompt,
    variantBThumbPrompt: parsed.variant_b_thumb_prompt,
  };
}

export function buildFallbackVariants(original: string): GeneratedVariants {
  const trimmed = original.trim();
  return {
    variantACaption: trimmed,
    variantBCaption: `${trimmed} — See results inside`,
    variantAThumbPrompt: `Eye-catching thumbnail for: ${trimmed.slice(0, 80)}`,
    variantBThumbPrompt: `Results-focused thumbnail showing success for: ${trimmed.slice(0, 80)}`,
    usedLlm: false,
  };
}
