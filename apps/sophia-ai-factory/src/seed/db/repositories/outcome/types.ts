/**
 * Outcome Tracking Types and Mappers
 *
 * Layer: seed (Foundational primitives)
 * @module seed/db/repositories/outcome/types
 */

import type {
  OutcomeMetric,
  OutcomeMetricType,
  OutcomeSummary,
  CreatorSopOutcome,
} from '@/seed/types/outcome';

export type {
  OutcomeMetric,
  OutcomeMetricType,
  OutcomeSummary,
  CreatorSopOutcome,
};

export interface RawOutcomeRow {
  id: string;
  execution_id: string;
  sop_id: string;
  user_id: string;
  metric_type: string;
  metric_value: number;
  source: string | null;
  recorded_at: number;
}

export interface AggRow {
  metric_type: string;
  avg_value: number;
  total_value: number;
  execution_count: number;
}

export interface CreatorAggRow {
  sop_id: string;
  metric_type: string;
  avg_value: number;
  execution_count: number;
}

export function mapRow(r: RawOutcomeRow): OutcomeMetric {
  return {
    id: r.id,
    executionId: r.execution_id,
    sopId: r.sop_id,
    userId: r.user_id,
    metricType: r.metric_type as OutcomeMetricType,
    metricValue: r.metric_value,
    source: r.source ?? undefined,
    recordedAt: r.recorded_at,
  };
}
