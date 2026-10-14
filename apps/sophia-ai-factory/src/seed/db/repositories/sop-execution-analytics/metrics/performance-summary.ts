/**
 * SOP and Creator Performance Summary Queries
 *
 * @module seed/db/repositories/sop-execution-analytics/metrics/performance-summary
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { SOPPerformanceSummary, CreatorPerformanceSummary } from '../types';

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
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
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
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
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
