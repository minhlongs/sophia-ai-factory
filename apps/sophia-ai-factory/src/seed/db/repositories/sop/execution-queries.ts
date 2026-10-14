/**
 * SOP Execution repository read queries
 *
 * @module seed/db/repositories/sop/execution-queries
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { SopExecutionDbRow } from '@/seed/db/types';

/**
 * Fetch a single execution row by ID.
 * Returns null when not found or on error.
 */
export async function getExecution(executionId: string): Promise<SopExecutionDbRow | null> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
    const row = await db
      .prepare(
        `SELECT id, user_id, org_id, sop_template_id, installation_id,
                status, input_json, output_json, error_message,
                current_step, total_steps, step_results, credits_used,
                started_at, completed_at
         FROM sop_executions
         WHERE id = ?1
         LIMIT 1`,
      )
      .bind(executionId)
      .first<SopExecutionDbRow>();

    return row ?? null;
  } catch (err) {
    logger.warn('[SopRepo] getExecution failed', { executionId, error: getErrorMessage(err) });
    return null;
  }
}

/**
 * List recent executions for a user, newest first.
 * Defaults to 20 results. Returns empty array on error.
 */
export async function getUserExecutions(
  userId: string,
  limit = 20,
): Promise<SopExecutionDbRow[]> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
    const result = await db
      .prepare(
        `SELECT id, user_id, org_id, sop_template_id, installation_id,
                status, input_json, output_json, error_message,
                current_step, total_steps, step_results, credits_used,
                started_at, completed_at
         FROM sop_executions
         WHERE user_id = ?1
         ORDER BY started_at DESC
         LIMIT ?2`,
      )
      .bind(userId, limit)
      .all<SopExecutionDbRow>();

    return result.results ?? [];
  } catch (err) {
    logger.error('[SopRepo] getUserExecutions failed', { userId, error: getErrorMessage(err) });
    return [];
  }
}
