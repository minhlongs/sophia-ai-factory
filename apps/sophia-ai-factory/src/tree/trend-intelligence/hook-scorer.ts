/**
 * Hook Scoring Engine — Hermes Intelligence V2
 *
 * Pure domain scoring implementing the canonical viral score formula:
 *   S_viral = 0.40 * S_hook + 0.25 * S_pacing + 0.20 * S_retention + 0.15 * S_cta
 *
 * Weight Normalization Proof:
 *   w_hook + w_pacing + w_retention + w_cta = 0.40 + 0.25 + 0.20 + 0.15 = 1.00
 *
 * Classifies video script openings into 6 canonical hook styles:
 *   - curiosity_gap: Suspense, withholding critical info
 *   - bold_claim: Shocking counter-intuitive assertion
 *   - problem_agitation: Warning, fatal mistake, or friction point
 *   - question: Direct inquiry activating viewer participation
 *   - story_lead: Anecdotal narrative lead-in
 *   - statistic_reveal: Hard data, percentages, counts, or dollar figures
 *
 * Layer: tree (domain reusable — depends only on seed and tree).
 * Zero :any types. Zero console.log.
 *
 * @module tree/trend-intelligence/hook-scorer
 */

import type {
  HookEvaluationInput,
  HookScoreResult,
  HookStyle,
} from '@/seed/types/creative-intelligence';
import { HOOK_STYLE_MATCHERS, sanitizeScore } from './hook-style-patterns';

/** Canonical weights for viral hook score evaluation */
export const VIRAL_SCORE_WEIGHTS = {
  hook: 0.4,
  pacing: 0.25,
  retention: 0.2,
  cta: 0.15,
} as const;

/** Canonical 6 hook style list */
export const CANONICAL_HOOK_STYLES: readonly HookStyle[] = [
  'curiosity_gap',
  'bold_claim',
  'problem_agitation',
  'question',
  'story_lead',
  'statistic_reveal',
] as const;

/**
 * Classifies a hook text string into one of the 6 canonical hook styles
 * using bilingual heuristic pattern matching.
 */
export function classifyHookStyle(hookText: string): HookStyle {
  const safeText = typeof hookText === 'string' ? hookText : '';
  const trimmed = safeText.trim();
  if (!trimmed) {
    return 'curiosity_gap';
  }

  for (const { style, patterns } of HOOK_STYLE_MATCHERS) {
    if (patterns.some((pattern) => pattern.test(trimmed))) {
      return style;
    }
  }

  return 'curiosity_gap';
}

/**
 * Evaluates and calculates the viral score for a video script opening.
 *
 * Formula:
 *   S_viral = 0.40 * S_hook + 0.25 * S_pacing + 0.20 * S_retention + 0.15 * S_cta
 *
 * All inputs are strictly sanitized against NaN, Infinity, -Infinity, null, and undefined.
 *
 * @param input Hook evaluation parameters including text and optional component scores.
 * @returns Fully validated HookScoreResult with detected style and normalized viral score.
 */
export function calculateHookScore(input: HookEvaluationInput): HookScoreResult {
  const hook = sanitizeScore(input.scores?.hookScore, 0.5);
  const pacing = sanitizeScore(input.scores?.pacingScore, 0.5);
  const retention = sanitizeScore(input.scores?.retentionScore, 0.5);
  const cta = sanitizeScore(input.scores?.ctaScore, 0.5);

  const rawViral =
    VIRAL_SCORE_WEIGHTS.hook * hook +
    VIRAL_SCORE_WEIGHTS.pacing * pacing +
    VIRAL_SCORE_WEIGHTS.retention * retention +
    VIRAL_SCORE_WEIGHTS.cta * cta;

  const boundedViral = Number.isFinite(rawViral) ? Math.min(1.0, Math.max(0.0, rawViral)) : 0.5;
  const viralScore = Math.round(boundedViral * 100) / 100;
  const detectedHookStyle = input.hookStyle ?? classifyHookStyle(input.hookText);

  return {
    viralScore,
    hookScore: hook,
    pacingScore: pacing,
    retentionScore: retention,
    ctaScore: cta,
    detectedHookStyle,
    weights: VIRAL_SCORE_WEIGHTS,
    reasoning: `Hook style '${detectedHookStyle}' evaluated with viral score ${viralScore.toFixed(2)} (Hook: ${hook.toFixed(2)}, Pacing: ${pacing.toFixed(2)}, Retention: ${retention.toFixed(2)}, CTA: ${cta.toFixed(2)})`,
  };
}
