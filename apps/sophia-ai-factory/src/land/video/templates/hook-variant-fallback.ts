/**
 * Hook Variant Types, Duration Estimator, Strategy Selector & Deterministic Fallback
 *
 * Layer: land (business domain — video template hooks)
 *
 * @module land/video/templates/hook-variant-fallback
 */

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

const STRATEGIES: HookStrategy[] = [
  'curiosity-gap',
  'shock-stat',
  'direct-question',
  'problem-solution',
  'social-proof',
];

export function selectStrategies(index: number): [HookStrategy, HookStrategy] {
  const i = index % STRATEGIES.length;
  const j = (i + 2) % STRATEGIES.length;
  return [STRATEGIES[i], STRATEGIES[j]];
}

const WORDS_PER_SECOND = 2.5;

export function estimateDurationSec(text: string): number {
  const wordCount = text.split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_SECOND));
}

export function buildFallback(topic: string, seedIndex: number): HookVariantResult {
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
