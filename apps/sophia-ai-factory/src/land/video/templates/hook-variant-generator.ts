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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HookVariant {
  hookText: string;
  /** Approximate speaking time in seconds */
  durationSec: number;
  strategy: HookStrategy;
}

export type HookStrategy =
  | 'curiosity-gap'
  | 'shock-stat'
  | 'direct-question'
  | 'problem-solution'
  | 'social-proof';

export interface HookVariantResult {
  variantA: HookVariant;
  variantB: HookVariant;
  usedLlm: boolean;
}

const LLM_HOOK_SCHEMA = z.object({
  variant_a: z.string().min(1),
  variant_b: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------

const STRATEGIES: HookStrategy[] = [
  'curiosity-gap',
  'shock-stat',
  'direct-question',
  'problem-solution',
  'social-proof',
];

function selectStrategies(index: number): [HookStrategy, HookStrategy] {
  const i = index % STRATEGIES.length;
  const j = (i + 2) % STRATEGIES.length;
  return [STRATEGIES[i], STRATEGIES[j]];
}

// ---------------------------------------------------------------------------
// Estimator
// ---------------------------------------------------------------------------

const WORDS_PER_SECOND = 2.5;

function estimateDurationSec(text: string): number {
  const wordCount = text.split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_SECOND));
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Deterministic fallback
// ---------------------------------------------------------------------------

function buildFallback(topic: string, seedIndex: number): HookVariantResult {
  const [stratA, stratB] = selectStrategies(seedIndex);

  const fallbacks: Record<HookStrategy, (t: string) => string> = {
    'curiosity-gap': (t) => `Nobody is talking about ${t.toLowerCase()} — but you need to know this.`,
    'shock-stat': (t) => `90% of creators fail at ${t.toLowerCase()}. Here's why.`,
    'direct-question': (t) => `Are you making this ${t.toLowerCase()} mistake?`,
    'problem-solution': (t) => `${t} is broken. Let me show you the fix.`,
    'social-proof': (t) => `I grew using ${t.toLowerCase()} — and here's the proof.`,
  };

  const textA = fallbacks[stratA](topic);
  const textB = fallbacks[stratB](topic);

  return {
    variantA: { hookText: textA, durationSec: estimateDurationSec(textA), strategy: stratA },
    variantB: { hookText: textB, durationSec: estimateDurationSec(textB), strategy: stratB },
    usedLlm: false,
  };
}
