/**
 * Winner Picker — Chi-square statistical significance + minimum sample size gates
 *
 * Winner condition: chi-square test p < 0.05 AND minimum sample size per variant
 * No-winner condition: both sides evaluated after MAX_WINDOW_HOURS with no significant winner
 *
 * Replaces the simple 2× CTR rule from pre-2026 versions.
 *
 * @module forest/ab/winner-picker
 */

import type { AbExperiment, WinnerEvaluation, WinnerVariant } from './ab-types';

// ---------------------------------------------------------------------------
// Configuration constants
// ---------------------------------------------------------------------------

/** Minimum impressions PER VARIANT before statistical test is valid. */
export const MIN_IMPRESSIONS_PER_VARIANT = 100;

/** After this many hours with no significant winner, mark as 'no_winner' (or marginal if substantial lead). */
export const MAX_WINDOW_HOURS = 48;

/** Chi-square significance threshold. Winner must have p < 0.05. */
export const SIGNIFICANCE_LEVEL = 0.05;

/** Minimum absolute CTR difference (percentage points) to consider "meaningful" at max window. */
export const MIN_CTR_DIFF_PCT = 0.5; // 0.5 percentage points

// ---------------------------------------------------------------------------
// CTR helpers
// ---------------------------------------------------------------------------

/**
 * Compute CTR for a variant.
 * Returns 0 when impressions === 0 to avoid division by zero.
 */
export function computeCtr(conversions: number, impressions: number): number {
  if (impressions === 0) return 0;
  return conversions / impressions;
}

// ---------------------------------------------------------------------------
// Chi-square test for 2×2 contingency table
// ---------------------------------------------------------------------------

/**
 * Chi-square test for independence (2×2 contingency table).
 * Tests: are conversion rates between variant A and B statistically different?
 *
 * Contingency table:
 * |              | Converted | Not Converted | Total |
 * | variant A    | a         | b             | nA    |
 * | variant B    | c         | d             | nB    |
 * | Total        | a+c       | b+d           | nA+nB |
 *
 * Expected: E_ij = (row_i_total * col_j_total) / grand_total
 * Chi-square = Σ (O - E)² / E for all 4 cells
 * df = 1 ( (2-1)*(2-1) )
 *
 * @returns { chi2: number; pValue: number; significant: boolean }
 */
export function chiSquareTest(
  conversionsA: number,
  impressionsA: number,
  conversionsB: number,
  impressionsB: number,
): { chi2: number; pValue: number; significant: boolean } {
  const a = conversionsA;
  const b = impressionsA - conversionsA;
  const c = conversionsB;
  const d = impressionsB - conversionsB;

  const nA = impressionsA;
  const nB = impressionsB;
  const total = nA + nB;
  const totalConverted = a + c;
  const totalNotConverted = b + d;

  // Edge case: no data at all
  if (total === 0) {
    return { chi2: 0, pValue: 1, significant: false };
  }

  // Expected frequencies under null hypothesis (no difference)
  const eA = (nA * totalConverted) / total;
  const eB = (nA * totalNotConverted) / total;
  const eC = (nB * totalConverted) / total;
  const eD = (nB * totalNotConverted) / total;

  // Avoid division by zero in edge cases
  if (eA === 0 || eB === 0 || eC === 0 || eD === 0) {
    return { chi2: 0, pValue: 1, significant: false };
  }

  const chi2 =
    (a - eA) ** 2 / eA +
    (b - eB) ** 2 / eB +
    (c - eC) ** 2 / eC +
    (d - eD) ** 2 / eD;

  // p-value for chi-square with df=1
  // Using Wilson-Hilferty approximation or direct computation
  // For df=1: p = 1 - erf(sqrt(chi2/2))
  // Approximation: p ≈ 2 * (1 - Φ(√χ²)) for df=1
  const pValue = pValueChiSquareDf1(chi2);

  return {
    chi2,
    pValue,
    significant: pValue < SIGNIFICANCE_LEVEL,
  };
}

/**
 * Approximate p-value for chi-square distribution with df=1.
 * Uses the relationship: sqrt(chi2) ~ N(0,1) for df=1
 * p = 2 * (1 - Φ(|z|)) where z = sqrt(chi2)
 */
function pValueChiSquareDf1(chi2: number): number {
  if (chi2 <= 0) return 1;
  const z = Math.sqrt(chi2);
  // Standard normal CDF approximation (Abramowitz & Stegun 7.1.26)
  const cdf = normalCdf(z);
  return 2 * (1 - cdf); // two-tailed
}

/**
 * Standard normal CDF approximation.
 * Using rational approximation with max error ~7e-8 (from Abramowitz & Stegun 7.1.27)
 */
function normalCdf(x: number): number {
  // Constants for rational approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  // Save the sign of x
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  // A&S formula 7.1.26
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

// ---------------------------------------------------------------------------
// Core evaluation
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeAgeHours(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  return (now - created) / (1000 * 60 * 60);
}