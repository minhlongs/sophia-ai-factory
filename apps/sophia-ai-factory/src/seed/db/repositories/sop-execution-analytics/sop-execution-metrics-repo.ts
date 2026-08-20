/**
 * Aggregate metrics, ratings, and performance queries for sop_execution_metrics table.
 *
 * @module seed/db/repositories/sop-execution-analytics/sop-execution-metrics-repo
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { SOPPerformanceSummary, CreatorPerformanceSummary } from './types';

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
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;;
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
  const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;;
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

/**
 * Aggregate performance metrics for a SOP template over its most recent executions.
 * success_rate = steps_completed / (steps_completed + steps_failed).
 * Returns null when no data exists or on error.
 */
export async function getSOPPerformanceMetrics(
  sopTemplateId: string,
  limit = 100,
): Promise<SOPPerformanceSummary | null> {
  try {
    const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;;
    const row = await db
      .prepare(
        `SELECT
           sop_template_id,
           COUNT(*) AS total_executions,
           AVG(total_duration_ms) AS avg_duration_ms,
           AVG(total_cost_cents) AS avg_cost_cents,
           CAST(SUM(steps_completed) AS REAL) /
             NULLIF(SUM(steps_completed) + SUM(steps_failed), 0) AS success_rate,
           AVG(quality_score) AS avg_quality_score
         FROM (
           SELECT * FROM sop_execution_metrics
           WHERE sop_template_id = ?1
           ORDER BY created_at DESC
           LIMIT ?2
         )`,
      )
      .bind(sopTemplateId, limit)
      .first<{
        sop_template_id: string;
        total_executions: number;
        avg_duration_ms: number;
        avg_cost_cents: number;
        success_rate: number | null;
        avg_quality_score: number | null;
      }>();

    if (!row || row.total_executions === 0) return null;

    return {
      sop_template_id: row.sop_template_id,
      total_executions: row.total_executions,
      avg_duration_ms: row.avg_duration_ms ?? 0,
      avg_cost_cents: row.avg_cost_cents ?? 0,
      success_rate: row.success_rate ?? 0,
      avg_quality_score: row.avg_quality_score,
    };
  } catch (err) {
    logger.error('[SopMetricsRepo] getSOPPerformanceMetrics failed', {
      sopTemplateId,
      error: getErrorMessage(err),
    });
    return null;
  }
}

/**
 * Aggregate performance metrics for a creator (user) across all their executions.
 * Returns null when no data exists or on error.
 */
export async function getCreatorPerformanceMetrics(
  userId: string,
  limit = 100,
): Promise<CreatorPerformanceSummary | null> {
  try {
    const _db = await getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;;
    const row = await db
      .prepare(
        `SELECT
           user_id,
           COUNT(*) AS total_executions,
           AVG(total_duration_ms) AS avg_duration_ms,
           AVG(total_cost_cents) AS avg_cost_cents,
           CAST(SUM(steps_completed) AS REAL) /
             NULLIF(SUM(steps_completed) + SUM(steps_failed), 0) AS success_rate
         FROM (
           SELECT * FROM sop_execution_metrics
           WHERE user_id = ?1
           ORDER BY created_at DESC
           LIMIT ?2
         )`,
      )
      .bind(userId, limit)
      .first<{
        user_id: string;
        total_executions: number;
        avg_duration_ms: number;
        avg_cost_cents: number;
        success_rate: number | null;
      }>();

    if (!row || row.total_executions === 0) return null;

    return {
      user_id: row.user_id,
      total_executions: row.total_executions,
      avg_duration_ms: row.avg_duration_ms ?? 0,
      avg_cost_cents: row.avg_cost_cents ?? 0,
      success_rate: row.success_rate ?? 0,
    };
  } catch (err) {
    logger.error('[SopMetricsRepo] getCreatorPerformanceMetrics failed', {
      userId,
      error: getErrorMessage(err),
    });
    return null;
  }
}
