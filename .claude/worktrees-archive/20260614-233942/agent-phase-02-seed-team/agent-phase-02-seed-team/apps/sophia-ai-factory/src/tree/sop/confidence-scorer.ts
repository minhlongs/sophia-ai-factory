/**
 * Confidence scorer for SOP step executions.
 * Computes a weighted score from 4 heuristic factors and determines
 * whether a step result should be escalated to a human reviewer.
 * @module tree/sop/confidence-scorer
 */

import type { ConfidenceFactors, ConfidenceScore, ScoreStepParams } from '@/seed/types/confidence';

// ── Weights ────────────────────────────────────────────────────────────────────
// Sum must equal 1.0. Adjust via environment config in future if needed.

const WEIGHT_OUTPUT = 0.3;
const WEIGHT_ERROR  = 0.3;
const WEIGHT_LATENCY = 0.2;
const WEIGHT_TOOL   = 0.2;

/** Default confidence threshold below which a step triggers escalation. */
const DEFAULT_ESCALATION_THRESHOLD = 0.8;

// ── Scoring ────────────────────────────────────────────────────────────────────

/**
 * Score a single SOP step execution using 4 heuristic factors.
 *
 * Factor formulas:
 * - outputLength:   min(actual / expected, 1.0)
 * - errorRate:      1 - (errorCount / totalSteps)
 * - latencyRatio:   min(expected / actual, 1.0)  — faster is better
 * - toolReliability: toolSuccessRate (caller-provided, 0-1)
 *
 * Final score = weighted average of all 4 factors.
 *
 * Edge cases:
 * - expectedLength === 0 → outputLength factor = 1.0
 * - durationMs === 0 → latencyRatio factor = 1.0
 * - totalSteps === 0 → errorRate factor = 1.0
 */
export function scoreStepConfidence(params: ScoreStepParams): ConfidenceScore {
  const outputLength = params.expectedLength > 0
    ? Math.min(params.outputLength / params.expectedLength, 1.0)
    : 1.0;

  const errorRate = params.totalSteps > 0
    ? Math.max(0, 1 - params.errorCount / params.totalSteps)
    : 1.0;

  const latencyRatio = params.durationMs > 0
    ? Math.min(params.expectedDurationMs / params.durationMs, 1.0)
    : 1.0;

  const toolReliability = Math.max(0, Math.min(params.toolSuccessRate, 1.0));

  const factors: ConfidenceFactors = { outputLength, errorRate, latencyRatio, toolReliability };

  const score =
    outputLength  * WEIGHT_OUTPUT  +
    errorRate     * WEIGHT_ERROR   +
    latencyRatio  * WEIGHT_LATENCY +
    toolReliability * WEIGHT_TOOL;

  return {
    id: crypto.randomUUID(),
    executionId: params.executionId,
    stepIndex: params.stepIndex,
    score: Math.round(score * 10000) / 10000, // 4dp precision
    factors,
    createdAt: Math.floor(Date.now() / 1000),
  };
}

/**
 * Determine whether a step result should be escalated to a human reviewer.
 * Returns true when score < threshold (default 0.8).
 */
export function shouldEscalate(score: number, threshold = DEFAULT_ESCALATION_THRESHOLD): boolean {
  return score < threshold;
}
