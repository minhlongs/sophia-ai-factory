/**
 * Confidence scoring & human escalation types.
 * Used by the confidence-scorer (tree) and confidence-escalation-repo (seed/db).
 * @module seed/types/confidence
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

export type EscalationStatus = 'pending' | 'approved' | 'rejected' | 'auto_resolved';

// ── Factor breakdown ──────────────────────────────────────────────────────────

/**
 * Individual factor scores (0-1 each) that compose the final confidence score.
 * - outputLength: ratio of actual vs expected output length
 * - errorRate:    1 minus the proportion of error steps
 * - latencyRatio: ratio of expected vs actual duration (capped at 1.0)
 * - toolReliability: fraction of tool calls that succeeded
 */
export interface ConfidenceFactors {
  outputLength: number;
  errorRate: number;
  latencyRatio: number;
  toolReliability: number;
}

// ── Domain types ──────────────────────────────────────────────────────────────

/** Persisted confidence record for a single SOP step execution. */
export interface ConfidenceScore {
  id: string;
  executionId: string;
  stepIndex: number;
  /** Weighted aggregate score in [0, 1]. */
  score: number;
  factors: ConfidenceFactors;
  createdAt: number;
}

/** Human escalation request raised when confidence drops below threshold. */
export interface EscalationRequest {
  id: string;
  executionId: string;
  stepIndex: number;
  reason: string;
  status: EscalationStatus;
  resolvedBy?: string;
  resolvedAt?: number;
  createdAt: number;
}

// ── Params ────────────────────────────────────────────────────────────────────

/** Input params for the confidence scorer. */
export interface ScoreStepParams {
  executionId: string;
  stepIndex: number;
  outputLength: number;
  expectedLength: number;
  errorCount: number;
  totalSteps: number;
  durationMs: number;
  expectedDurationMs: number;
  toolSuccessRate: number;
}
