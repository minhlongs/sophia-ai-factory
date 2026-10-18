/**
 * Hook Variant Generator — Generate video hook variants for templates
 *
 * Produces 2 distinct opening-hook alternatives for a video script.
 * Falls back to a deterministic pattern if the LLM call fails.
 *
 * Layer: land (business domain — video template hooks)
 *
 * @module land/video/templates/hook-variant-generator
 */

import { z } from 'zod';
import { logger } from '@/seed/utils/logger-utility';
import { resilientChatCompletion } from '@/seed/inference/openrouter-client';
import {
  buildFallback,
  estimateDurationSec,
  selectStrategies,
  type HookStrategy,
  type HookVariant,
  type HookVariantResult,
} from './hook-variant-fallback';

export type { HookVariant, HookStrategy, HookVariantResult };

const LLM_HOOK_SCHEMA = z.object({
  variant_a: z.string().min(1),
  variant_b: z.string().min(1),
});

/**
 * Generate two hook variants for a video script.
 *
 * @param topic     - The video topic / subject
 * @param audience  - Optional target audience hint
 * @param seedIndex - Deterministic seed for strategy selection (default 0)
 */
export async function generateHookVariants(
  topic: string,
  opts?: { audience?: string; seedIndex?: number; byokOpenRouterKey?: string },
): Promise<HookVariantResult> {
  const audienceHint = opts?.audience ? ` Target audience: ${opts.audience}.` : '';
  const seedIndex = opts?.seedIndex ?? 0;
  const prompt = [
    `You are a YouTube short-form video scriptwriter.`,
    `Write exactly 2 alternative opening hooks (1-2 sentences each) for a video about: "${topic}".${audienceHint}`,
    '',
    'Return JSON: { "variant_a": "...", "variant_b": "..." }',
    'Variant A: curiosity-gap style. Variant B: shock-stat style.',
    'Each hook must be under 30 words.',
  ].join('\n');

  try {
    const response = await resilientChatCompletion(prompt, {
      openRouterKey: opts?.byokOpenRouterKey ?? null,
      anthropicKey: undefined,
      enableFallback: false,
      model: 'openai/fable-5o-mini',
    });

    const parsed = JSON.parse(response);
    const validated = LLM_HOOK_SCHEMA.parse(parsed);
    const [stratA, stratB] = selectStrategies(seedIndex);

    return {
      variantA: {
        hookText: validated.variant_a,
        durationSec: estimateDurationSec(validated.variant_a),
        strategy: stratA,
      },
      variantB: {
        hookText: validated.variant_b,
        durationSec: estimateDurationSec(validated.variant_b),
        strategy: stratB,
      },
      usedLlm: true,
    };
  } catch (err) {
    logger.warn('[hook-variant-generator] LLM call failed, using fallback', {
      error: err instanceof Error ? err.message : String(err),
    });
    return buildFallback(topic, seedIndex);
  }
}
