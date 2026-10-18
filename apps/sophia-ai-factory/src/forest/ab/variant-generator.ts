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

import { logger } from '@/seed/utils/logger-utility';
import {
  VariantGeneratorInputSchema,
  type VariantGeneratorInput,
  type GeneratedVariants,
  callVariantLlm,
  buildFallbackVariants,
} from './variant-generator-helpers';

export {
  VariantGeneratorInputSchema,
  type VariantGeneratorInput,
  type GeneratedVariants,
};

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
    return buildFallbackVariants(parsed.originalCaption);
  }

  try {
    const variants = await callVariantLlm(parsed);
    return { ...variants, usedLlm: true };
  } catch (err) {
    logger.warn('[variant-generator] LLM call failed, using fallback', {
      error: err instanceof Error ? err.message : String(err),
    });
    return buildFallbackVariants(parsed.originalCaption);
  }
}
