/**
 * Performance Feedback Engine — scheduled evaluation + prompt optimization.
 * Layer: tree (domain-reusable, imports seed only)
 */

import { getD1Raw } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import type { FeedbackCycle, EvaluationResult, PromptOptimization } from '@/seed/types/performance-feedback'
import { rowToCycle, rowToOptimization } from './performance-feedback-mappers'
import { computeEvaluation } from './performance-feedback-scoring'

/** Evaluate-after window: 7 days in seconds */
const EVALUATE_AFTER_SECONDS = 604800

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new feedback cycle for a published SOP execution.
 * evaluate_at = publishedAt + 7 days.
 */
export async function createFeedbackCycle(params: {
  executionId: string
  sopId: string
  userId: string
  publishedAt: number
}): Promise<string> {
  const id = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)
  const evaluateAt = params.publishedAt + EVALUATE_AFTER_SECONDS

  try {
    const db = await getD1Raw()
    await db
      .prepare(
        `INSERT INTO performance_feedback_cycles
         (id, execution_id, sop_id, user_id, published_at, evaluate_at, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
      )
      .bind(id, params.executionId, params.sopId, params.userId, params.publishedAt, evaluateAt, now)
      .run()

    logger.info('feedback_cycle.created', { id, sopId: params.sopId })
    return id
  } catch (err) {
    logger.error('feedback_cycle.create_failed', { error: getErrorMessage(err) })
    throw err
  }
}

/**
 * Return all pending cycles whose evaluate_at has passed.
 */
export async function getPendingEvaluations(now?: number): Promise<FeedbackCycle[]> {
  const cutoff = now ?? Math.floor(Date.now() / 1000)

  try {
    const db = await getD1Raw()
    const { results } = await db
      .prepare(
        `SELECT * FROM performance_feedback_cycles
         WHERE status = 'pending' AND evaluate_at <= ?
         ORDER BY evaluate_at ASC`
      )
      .bind(cutoff)
      .all()

    return (results as Record<string, unknown>[]).map(rowToCycle)
  } catch (err) {
    logger.error('feedback_cycle.pending_query_failed', { error: getErrorMessage(err) })
    throw err
  }
}

/**
 * Evaluate cycle performance given real-world metrics.
 * Stores result and transitions status to 'completed'.
 *
 * Expected metric keys:
 *   actual_views, expected_views,
 *   actual_engagement, expected_engagement,
 *   actual_revenue, expected_revenue
 *
 * Scoring weights: revenue 50%, views 30%, engagement 20%.
 */
export async function evaluatePerformance(
  cycleId: string,
  metrics: Record<string, number>
): Promise<EvaluationResult> {
  const evaluation = computeEvaluation(metrics)

  try {
    const db = await getD1Raw()
    await db
      .prepare(
        `UPDATE performance_feedback_cycles
         SET status = 'completed', metrics_json = ?, evaluation_json = ?
         WHERE id = ?`
      )
      .bind(JSON.stringify(metrics), JSON.stringify(evaluation), cycleId)
      .run()

    logger.info('feedback_cycle.evaluated', { cycleId, overallScore: evaluation.overallScore })
    return evaluation
  } catch (err) {
    logger.error('feedback_cycle.evaluate_failed', { cycleId, error: getErrorMessage(err) })
    throw err
  }
}

/**
 * Log a suggested prompt optimization for a given SOP step.
 */
export async function suggestOptimization(params: {
  cycleId: string
  sopId: string
  stepIndex: number
  originalPrompt: string
  suggestedPrompt: string
  improvementScore?: number
}): Promise<string> {
  const id = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)

  try {
    const db = await getD1Raw()
    await db
      .prepare(
        `INSERT INTO prompt_optimization_log
         (id, cycle_id, sop_id, step_index, original_prompt, suggested_prompt, improvement_score, applied, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
      )
      .bind(
        id, params.cycleId, params.sopId, params.stepIndex,
        params.originalPrompt, params.suggestedPrompt,
        params.improvementScore ?? null, now
      )
      .run()

    logger.info('optimization.suggested', { id, sopId: params.sopId, stepIndex: params.stepIndex })
    return id
  } catch (err) {
    logger.error('optimization.suggest_failed', { error: getErrorMessage(err) })
    throw err
  }
}

/**
 * Mark an optimization as applied. Idempotent.
 */
export async function applyOptimization(optimizationId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000)

  try {
    const db = await getD1Raw()
    await db
      .prepare(`UPDATE prompt_optimization_log SET applied = 1, applied_at = ? WHERE id = ?`)
      .bind(now, optimizationId)
      .run()

    logger.info('optimization.applied', { optimizationId })
  } catch (err) {
    logger.error('optimization.apply_failed', { optimizationId, error: getErrorMessage(err) })
    throw err
  }
}

/**
 * Return all optimizations for a SOP, ordered by step then creation date.
 */
export async function getOptimizationsForSOP(sopId: string): Promise<PromptOptimization[]> {
  try {
    const db = await getD1Raw()
    const { results } = await db
      .prepare(
        `SELECT * FROM prompt_optimization_log
         WHERE sop_id = ?
         ORDER BY step_index ASC, created_at DESC`
      )
      .bind(sopId)
      .all()

    return (results as Record<string, unknown>[]).map(rowToOptimization)
  } catch (err) {
    logger.error('optimization.query_failed', { sopId, error: getErrorMessage(err) })
    throw err
  }
}
