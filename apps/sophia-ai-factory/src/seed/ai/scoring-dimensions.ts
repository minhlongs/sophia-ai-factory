/**
 * Per-dimension scoring functions for the provider scoring engine.
 *
 * @module seed/ai/scoring-dimensions
 */

import { tokenizeText, expandSynonyms, keywordOverlap } from './scoring-helpers';

// ── Per-dimension scorers ─────────────────────────────────────────────────────

/**
 * Score how well a tool's best_for matches the task intent and style.
 *
 * Uses synonym expansion and real tokenisation so that semantic near-misses
 * (e.g. "cinematic" vs "film") and punctuation-adjacent tokens
 * (e.g. "trailers," vs "trailer") still score well.
 */
export function computeTaskFit(
  bestFor: Set<string>,
  intent: string,
  styleKeywords: Set<string>,
): number {
  if (bestFor.size === 0) return 0.3; // Unknown capability — modest default

  const intentWords = expandSynonyms(
    new Set(tokenizeText(intent)),
  );
  const bestForWords = expandSynonyms(
    new Set([...bestFor].flatMap((desc) => tokenizeText(desc))),
  );

  const intentScore = keywordOverlap(intentWords, bestForWords);
  const styleExpanded = expandSynonyms(
    new Set([...styleKeywords].map((kw) => kw.toLowerCase())),
  );
  const styleScore = keywordOverlap(styleExpanded, bestForWords);

  return Math.min(1.0, intentScore * 0.7 + styleScore * 0.3 + 0.1);
}

/**
 * Score controllability from the supports dict.
 *
 * Features are weighted by creative impact — controlnet and reference_image
 * are worth more than seed or aspect_ratio.
 */
export function computeControl(supports: Readonly<Record<string, boolean>>): number {
  const controlFeatures: readonly [string, number][] = [
    ['controlnet', 2.0],
    ['reference_image', 1.8],
    ['style_transfer', 1.5],
    ['inpainting', 1.5],
    ['img2img', 1.3],
    ['negative_prompt', 1.0],
    ['custom_size', 0.8],
    ['aspect_ratio', 0.7],
    ['seed', 0.5],
  ];

  if (!supports || Object.keys(supports).length === 0) return 0.3;

  const totalWeight = controlFeatures.reduce((sum, [, w]) => sum + w, 0);
  const earned = controlFeatures
    .filter(([feature]) => supports[feature])
    .reduce((sum, [, w]) => sum + w, 0);

  return Math.min(1.0, earned / (totalWeight * 0.5));
}

/**
 * Score cost efficiency. Free is 1.0, over-budget is 0.0.
 */
export function computeCostEfficiency(
  estimatedCost: number,
  budgetRemaining: number | undefined,
): number {
  if (estimatedCost <= 0) return 1.0;
  if (budgetRemaining !== undefined && budgetRemaining <= 0) return 0.0;

  if (budgetRemaining !== undefined) {
    const ratio = estimatedCost / budgetRemaining;
    if (ratio > 0.5) return 0.1;
    if (ratio > 0.2) return 0.5;
    return 0.8;
  }

  // No budget info — use absolute cost heuristic
  if (estimatedCost < 0.05) return 0.9;
  if (estimatedCost < 0.20) return 0.7;
  if (estimatedCost < 1.00) return 0.5;
  return 0.3;
}

/**
 * Score how well this provider fits already-locked decisions.
 */
export function computeContinuity(
  provider: string,
  lockedProviders: readonly string[],
): number {
  if (lockedProviders.length === 0) return 0.5; // No prior context
  return lockedProviders.includes(provider) ? 0.9 : 0.4;
}
