/**
 * Winner Picker — Simple 2× CTR rule evaluation
 *
 * Winner condition: CTR(variant) >= 2× CTR(other) AND total impressions >= MIN_IMPRESSIONS
 * No-winner condition: both sides evaluated after MAX_WINDOW_HOURS with no clear winner
 *
 * This module is pure computation — no D1 calls. Persistence is handled by experiment-store.
 * Makes it easy to unit-test without mocking D1.
 *
 * @module forest/ab/winner-picker
 */

import type { AbExperiment, WinnerEvaluation, WinnerVariant } from './ab-types';

/** Minimum total impressions (A + B) before declaring a winner. */
export const MIN_IMPRESSIONS = 100;

/** After this many hours with no winner, mark as 'no_winner'. */
export const MAX_WINDOW_HOURS = 48;

/** Multiplier required: winner CTR >= WINNER_MULTIPLIER × loser CTR. */
export const WINNER_MULTIPLIER = 2;

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
// Core evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate whether a winner can be declared for a single experiment.
 *
 * Decision rules:
 * 1. If total impressions < MIN_IMPRESSIONS → 'pending' (return null)
 * 2. If ctrA >= WINNER_MULTIPLIER * ctrB → winner = 'a'
 * 3. If ctrB >= WINNER_MULTIPLIER * ctrA → winner = 'b'
 * 4. If experiment is older than MAX_WINDOW_HOURS → 'no_winner'
 * 5. Otherwise → 'pending' (return null — keep running)
 */
export function evaluateWinner(experiment: AbExperiment): WinnerEvaluation | null {
  const totalImpressions = experiment.impressionsA + experiment.impressionsB;
  const ctrA = computeCtr(experiment.conversionsA, experiment.impressionsA);
  const ctrB = computeCtr(experiment.conversionsB, experiment.impressionsB);

  // Not enough data yet — regardless of age
  if (totalImpressions < MIN_IMPRESSIONS) {
    const ageHours = computeAgeHours(experiment.createdAt);
    if (ageHours < MAX_WINDOW_HOURS) return null;

    // Past max window, still low traffic → declare no_winner
    return {
      experimentId: experiment.id,
      winner: 'no_winner',
      ctrA,
      ctrB,
      reason: `Max window (${MAX_WINDOW_HOURS}h) reached with insufficient impressions (${totalImpressions} < ${MIN_IMPRESSIONS})`,
    };
  }

  // Clear winner check
  if (ctrA >= WINNER_MULTIPLIER * ctrB && ctrA > 0) {
    return {
      experimentId: experiment.id,
      winner: 'a',
      ctrA,
      ctrB,
      reason: `Variant A CTR (${(ctrA * 100).toFixed(2)}%) >= 2× Variant B CTR (${(ctrB * 100).toFixed(2)}%)`,
    };
  }

  if (ctrB >= WINNER_MULTIPLIER * ctrA && ctrB > 0) {
    return {
      experimentId: experiment.id,
      winner: 'b',
      ctrA,
      ctrB,
      reason: `Variant B CTR (${(ctrB * 100).toFixed(2)}%) >= 2× Variant A CTR (${(ctrA * 100).toFixed(2)}%)`,
    };
  }

  // No clear winner yet — check if we've hit the time limit
  const ageHours = computeAgeHours(experiment.createdAt);
  if (ageHours >= MAX_WINDOW_HOURS) {
    const winner: WinnerVariant = ctrA > ctrB ? 'a' : ctrB > ctrA ? 'b' : 'no_winner';
    return {
      experimentId: experiment.id,
      winner,
      ctrA,
      ctrB,
      reason: `Max window (${MAX_WINDOW_HOURS}h) reached — ${
        winner === 'no_winner'
          ? 'tied CTR, no clear winner'
          : `marginal lead for variant ${winner.toUpperCase()}`
      }`,
    };
  }

  // Still within window, no clear winner yet
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
