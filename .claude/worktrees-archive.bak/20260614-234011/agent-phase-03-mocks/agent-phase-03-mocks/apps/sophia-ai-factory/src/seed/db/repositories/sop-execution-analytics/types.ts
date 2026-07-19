/**
 * Shared row and summary types for SOP execution analytics.
 *
 * @module seed/db/repositories/sop-execution-analytics/types
 */

export interface SopExecutionLogRow {
  id: string;
  execution_id: string;
  sop_template_id: string;
  user_id: string;
  step_index: number;
  step_name: string;
  status: 'started' | 'completed' | 'failed' | 'skipped';
  input_hash: string | null;
  output_summary: string | null;
  duration_ms: number | null;
  cost_cents: number;
  error_message: string | null;
  created_at: number;
}

export interface SopExecutionMetricsRow {
  id: string;
  execution_id: string;
  sop_template_id: string;
  user_id: string;
  total_duration_ms: number;
  total_cost_cents: number;
  steps_completed: number;
  steps_failed: number;
  quality_score: number | null;
  user_rating: number | null;
  feedback_text: string | null;
  created_at: number;
  updated_at: number;
}

export interface SOPPerformanceSummary {
  sop_template_id: string;
  total_executions: number;
  avg_duration_ms: number;
  avg_cost_cents: number;
  success_rate: number;
  avg_quality_score: number | null;
}

export interface CreatorPerformanceSummary {
  user_id: string;
  total_executions: number;
  avg_duration_ms: number;
  avg_cost_cents: number;
  success_rate: number;
}
