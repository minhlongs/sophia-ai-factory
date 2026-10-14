import type {
  ConfidenceFactors,
  ConfidenceScore,
  EscalationRequest,
  EscalationStatus,
} from '@/seed/types/confidence';

export interface RawConfidenceRow {
  id: string;
  execution_id: string;
  step_index: number;
  score: number;
  factors_json: string | null;
  created_at: number;
}

export interface RawEscalationRow {
  id: string;
  execution_id: string;
  step_index: number;
  reason: string;
  status: string;
  resolved_by: string | null;
  resolved_at: number | null;
  created_at: number;
}

export function mapConfidence(r: RawConfidenceRow): ConfidenceScore {
  return {
    id: r.id,
    executionId: r.execution_id,
    stepIndex: r.step_index,
    score: r.score,
    factors: r.factors_json
      ? (JSON.parse(r.factors_json) as ConfidenceFactors)
      : { outputLength: 0, errorRate: 0, latencyRatio: 0, toolReliability: 0 },
    createdAt: r.created_at,
  };
}

export function mapEscalation(r: RawEscalationRow): EscalationRequest {
  return {
    id: r.id,
    executionId: r.execution_id,
    stepIndex: r.step_index,
    reason: r.reason,
    status: r.status as EscalationStatus,
    resolvedBy: r.resolved_by ?? undefined,
    resolvedAt: r.resolved_at ?? undefined,
    createdAt: r.created_at,
  };
}
