import type { AbExperiment, WinnerEvaluation, WinnerVariant } from '../ab-types';
import {
  MIN_IMPRESSIONS_PER_VARIANT,
  MAX_WINDOW_HOURS,
  SIGNIFICANCE_LEVEL,
  MIN_CTR_DIFF_PCT,
} from './constants';
import { computeCtr, computeAgeHours } from './ctr-math';
import { chiSquareTest } from './chi-square';

/**
 * Evaluate whether a winner can be declared for a single experiment.
 *
 * Decision rules:
 * 1. If either variant has < MIN_IMPRESSIONS_PER_VARIANT → 'pending' (null)
 * 2. If chi-square test p < 0.05 → declare winner (higher CTR variant)
 * 3. If experiment age >= MAX_WINDOW_HOURS:
 *    - If significant → winner
 *    - If not significant but |CTR_A - CTR_B| >= MIN_CTR_DIFF_PCT → marginal winner (higher CTR)
 *    - Else → 'no_winner'
 * 4. Otherwise → 'pending' (null)
 */
export function evaluateWinner(experiment: AbExperiment): WinnerEvaluation | null {
  const impressionsA = experiment.impressionsA;
  const impressionsB = experiment.impressionsB;
  const conversionsA = experiment.conversionsA;
  const conversionsB = experiment.conversionsB;

  const ctrA = computeCtr(conversionsA, impressionsA);
  const ctrB = computeCtr(conversionsB, impressionsB);

  // Rule 1: Minimum sample size per variant
  if (impressionsA < MIN_IMPRESSIONS_PER_VARIANT || impressionsB < MIN_IMPRESSIONS_PER_VARIANT) {
    const ageHours = computeAgeHours(experiment.createdAt);
    if (ageHours < MAX_WINDOW_HOURS) return null;

    // Past max window but still low impressions → no_winner
    return {
      experimentId: experiment.id,
      winner: 'no_winner',
      ctrA,
      ctrB,
      reason: `Max window (${MAX_WINDOW_HOURS}h) reached with insufficient impressions (A=${impressionsA}, B=${impressionsB} < ${MIN_IMPRESSIONS_PER_VARIANT}/variant)`,
    };
  }

  // Rule 2: Statistical significance test
  const { chi2, pValue, significant } = chiSquareTest(conversionsA, impressionsA, conversionsB, impressionsB);

  if (significant) {
    const winner: WinnerVariant = ctrA > ctrB ? 'a' : 'b';
    return {
      experimentId: experiment.id,
      winner,
      ctrA,
      ctrB,
      reason: `Chi-square p=${pValue.toFixed(4)} < ${SIGNIFICANCE_LEVEL} (χ²=${chi2.toFixed(2)}). Winner: variant ${winner.toUpperCase()} (CTR: ${winner === 'a' ? ctrA : ctrB * 100}% vs ${winner === 'a' ? ctrB : ctrA * 100}%)`,
    };
  }

  // Rule 3: Max window reached without significance
  const ageHours = computeAgeHours(experiment.createdAt);
  if (ageHours >= MAX_WINDOW_HOURS) {
    const ctrDiffPct = Math.abs(ctrA - ctrB) * 100;
    // Use small epsilon to handle floating point precision (e.g., 0.105 - 0.1 = 0.004999...)
    const eps = 1e-10;
    if (ctrDiffPct >= MIN_CTR_DIFF_PCT - eps) {
      const winner: WinnerVariant = ctrA > ctrB ? 'a' : 'b';
      return {
        experimentId: experiment.id,
        winner,
        ctrA,
        ctrB,
        reason: `Max window (${MAX_WINDOW_HOURS}h) reached. No statistical significance (p=${pValue.toFixed(4)}), but CTR difference (${ctrDiffPct.toFixed(2)}pp) >= ${MIN_CTR_DIFF_PCT}pp. Marginal winner: variant ${winner.toUpperCase()}.`,
      };
    }

    return {
      experimentId: experiment.id,
      winner: 'no_winner',
      ctrA,
      ctrB,
      reason: `Max window (${MAX_WINDOW_HOURS}h) reached. No statistical significance (p=${pValue.toFixed(4)}), CTR difference (${ctrDiffPct.toFixed(2)}pp) < ${MIN_CTR_DIFF_PCT}pp. No clear winner.`,
    };
  }

  // Rule 4: Still within window, no significance yet
  return null;
}

/**
 * Batch-evaluate a list of active experiments.
 * Returns only those with a decision (winner or no_winner).
 */
export function evaluateBatch(experiments: AbExperiment[]): WinnerEvaluation[] {
  const decisions: WinnerEvaluation[] = [];
  for (const exp of experiments) {
    const result = evaluateWinner(exp);
    if (result !== null) {
      decisions.push(result);
    }
  }
  return decisions;
}
