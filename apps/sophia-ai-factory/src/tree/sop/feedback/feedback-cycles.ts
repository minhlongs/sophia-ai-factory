/**
 * Feedback Cycles Manager
 * Layer: tree/sop
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { FeedbackCycle, EvaluationResult } from '@/seed/types/performance-feedback';
import { rowToCycle } from '../performance-feedback-mappers';
import { computeEvaluation } from '../performance-feedback-scoring';

/** Evaluate-after window: 7 days in seconds */
export const EVALUATE_AFTER_SECONDS = 604800;

/**
 * Create a new feedback cycle for a published SOP execution.
 * evaluate_at = publishedAt + 7 days.
 */
export async function createFeedbackCycle(params: {
  executionId: string;
  sopId: string;
  userId: string;
  publishedAt: number;
}): Promise<string> {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const evaluateAt = params.publishedAt + EVALUATE_AFTER_SECONDS;

  try {
    const db = await getD1();
    if (!db) throw new Error('D1 database binding not available');
    await db
      .prepare(
        `INSERT INTO performance_feedback_cycles
         (id, execution_id, sop_id, user_id, published_at, evaluate_at, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .bind(id, params.executionId, params.sopId, params.userId, params.publishedAt, evaluateAt, now)
      .run();

    logger.info('feedback_cycle.created', { id, sopId: params.sopId });
    return id;
  } catch (err) {
    logger.error('feedback_cycle.create_failed', { error: getErrorMessage(err) });
    throw err;
  }
}

/**
 * Return all pending cycles whose evaluate_at has passed.
 */
export async function getPendingEvaluations(now?: number): Promise<FeedbackCycle[]> {
  const cutoff = now ?? Math.floor(Date.now() / 1000);

  try {
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
    const { results } = await db
      .prepare(
        `SELECT * FROM performance_feedback_cycles
         WHERE status = 'pending' AND evaluate_at <= ?
         ORDER BY evaluate_at ASC`,
      )
      .bind(cutoff)
      .all();

    return (results as Record<string, unknown>[]).map(rowToCycle);
  } catch (err) {
    logger.error('feedback_cycle.pending_query_failed', { error: getErrorMessage(err) });
    throw err;
  }
}

/**
 * Evaluate cycle performance given real-world metrics.
 * Stores result and transitions status to 'completed'.
 *
 * Scoring weights: revenue 50%, views 30%, engagement 20%.
 */
export async function evaluatePerformance(
  cycleId: string,
  metrics: Record<string, number>,
): Promise<EvaluationResult> {
  const evaluation = computeEvaluation(metrics);

  try {
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
    await db
      .prepare(
        `UPDATE performance_feedback_cycles
         SET status = 'completed', metrics_json = ?, evaluation_json = ?
         WHERE id = ?`,
      )
      .bind(JSON.stringify(metrics), JSON.stringify(evaluation), cycleId)
      .run();

    logger.info('feedback_cycle.evaluated', { cycleId, overallScore: evaluation.overallScore });
    return evaluation;
  } catch (err) {
    logger.error('feedback_cycle.evaluate_failed', { cycleId, error: getErrorMessage(err) });
    throw err;
  }
}
