/**
 * Prompt Optimizations Manager
 * Layer: tree/sop
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { PromptOptimization } from '@/seed/types/performance-feedback';
import { rowToOptimization } from '../performance-feedback-mappers';

/**
 * Log a suggested prompt optimization for a given SOP step.
 */
export async function suggestOptimization(params: {
  cycleId: string;
  sopId: string;
  stepIndex: number;
  originalPrompt: string;
  suggestedPrompt: string;
  improvementScore?: number;
}): Promise<string> {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  try {
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
    await db
      .prepare(
        `INSERT INTO prompt_optimization_log
         (id, cycle_id, sop_id, step_index, original_prompt, suggested_prompt, improvement_score, applied, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      )
      .bind(
        id,
        params.cycleId,
        params.sopId,
        params.stepIndex,
        params.originalPrompt,
        params.suggestedPrompt,
        params.improvementScore ?? null,
        now,
      )
      .run();

    logger.info('optimization.suggested', { id, sopId: params.sopId, stepIndex: params.stepIndex });
    return id;
  } catch (err) {
    logger.error('optimization.suggest_failed', { error: getErrorMessage(err) });
    throw err;
  }
}

/**
 * Mark an optimization as applied. Idempotent.
 */
export async function applyOptimization(optimizationId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  try {
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
    await db
      .prepare(`UPDATE prompt_optimization_log SET applied = 1, applied_at = ? WHERE id = ?`)
      .bind(now, optimizationId)
      .run();

    logger.info('optimization.applied', { optimizationId });
  } catch (err) {
    logger.error('optimization.apply_failed', { optimizationId, error: getErrorMessage(err) });
    throw err;
  }
}

/**
 * Return all optimizations for a SOP, ordered by step then creation date.
 */
export async function getOptimizationsForSOP(sopId: string): Promise<PromptOptimization[]> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
    const { results } = await db
      .prepare(
        `SELECT * FROM prompt_optimization_log
         WHERE sop_id = ?
         ORDER BY step_index ASC, created_at DESC`,
      )
      .bind(sopId)
      .all();

    return (results as Record<string, unknown>[]).map(rowToOptimization);
  } catch (err) {
    logger.error('optimization.query_failed', { sopId, error: getErrorMessage(err) });
    throw err;
  }
}
