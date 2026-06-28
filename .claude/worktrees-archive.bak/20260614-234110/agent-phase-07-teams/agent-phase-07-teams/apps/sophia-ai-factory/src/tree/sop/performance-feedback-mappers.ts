/**
 * Row → domain type mappers for performance feedback tables.
 * Layer: tree (internal — not exported via barrel)
 */

import type { FeedbackCycle, FeedbackStatus, EvaluationResult, PromptOptimization } from '@/seed/types/performance-feedback'

export function rowToCycle(row: Record<string, unknown>): FeedbackCycle {
  return {
    id: row.id as string,
    executionId: row.execution_id as string,
    sopId: row.sop_id as string,
    userId: row.user_id as string,
    publishedAt: row.published_at as number,
    evaluateAt: row.evaluate_at as number,
    status: row.status as FeedbackStatus,
    metrics: row.metrics_json
      ? (JSON.parse(row.metrics_json as string) as Record<string, number>)
      : undefined,
    evaluation: row.evaluation_json
      ? (JSON.parse(row.evaluation_json as string) as EvaluationResult)
      : undefined,
    createdAt: row.created_at as number,
  }
}

export function rowToOptimization(row: Record<string, unknown>): PromptOptimization {
  return {
    id: row.id as string,
    cycleId: row.cycle_id as string,
    sopId: row.sop_id as string,
    stepIndex: row.step_index as number,
    originalPrompt: row.original_prompt as string,
    suggestedPrompt: row.suggested_prompt as string,
    improvementScore: row.improvement_score != null ? (row.improvement_score as number) : undefined,
    applied: (row.applied as number) === 1,
    appliedAt: row.applied_at != null ? (row.applied_at as number) : undefined,
    createdAt: row.created_at as number,
  }
}
