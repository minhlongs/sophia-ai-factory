/**
 * SOP Execution Metrics Logger & Rating Operations
 *
 * @module seed/db/repositories/sop-execution-analytics/metrics/execution-logger
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Insert or update the aggregate metrics row for a completed execution.
 * Uses ON CONFLICT(execution_id) to handle idempotent completion logging.
 * Returns the metrics row ID (may be a new UUID even on update).
 * Throws on D1 error.
 */
export async function logExecutionCompletion(params: {
  executionId: string;
  sopTemplateId: string;
  userId: string;
  totalDurationMs: number;
  totalCostCents?: number;
  stepsCompleted: number;
  stepsFailed: number;
  qualityScore?: number;
}): Promise<string> {
  const db = await getD1();
  if (!db) throw new Error('D1 binding not available');
  const id = crypto.randomUUID();
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO sop_execution_metrics
         (id, execution_id, sop_template_id, user_id,
          total_duration_ms, total_cost_cents, steps_completed, steps_failed,
          quality_score, user_rating, feedback_text,
          created_at, updated_at)
       VALUES
         (?1, ?2, ?3, ?4,
          ?5, ?6, ?7, ?8,
          ?9, NULL, NULL,
          ?10, ?10)
       ON CONFLICT(execution_id) DO UPDATE SET
         total_duration_ms = excluded.total_duration_ms,
         total_cost_cents  = excluded.total_cost_cents,
         steps_completed   = excluded.steps_completed,
         steps_failed      = excluded.steps_failed,
         quality_score     = excluded.quality_score,
         updated_at        = excluded.updated_at`,
    )
    .bind(
      id,
      params.executionId,
      params.sopTemplateId,
      params.userId,
      params.totalDurationMs,
      params.totalCostCents ?? 0,
      params.stepsCompleted,
      params.stepsFailed,
      params.qualityScore ?? null,
      now,
    )
    .run();

  logger.info('[SopMetricsRepo] Execution metrics logged', {
    executionId: params.executionId,
    stepsCompleted: params.stepsCompleted,
    stepsFailed: params.stepsFailed,
  });

  return id;
}

/**
 * Record a user rating (1–5) and optional feedback for a completed execution.
 * Silent no-op if executionId not found.
 * Throws on D1 error.
 */
export async function rateExecution(
  executionId: string,
  rating: number,
  feedbackText?: string,
): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('D1 binding not available');
  const now = Date.now();

  await db
    .prepare(
      `UPDATE sop_execution_metrics
       SET user_rating   = ?2,
           feedback_text = ?3,
           updated_at    = ?4
       WHERE execution_id = ?1`,
    )
    .bind(executionId, rating, feedbackText ?? null, now)
    .run();

  logger.info('[SopMetricsRepo] Execution rated', { executionId, rating });
}
