/**
 * Per-step execution log writes and reads for sop_execution_logs table.
 *
 * @module seed/db/repositories/sop-execution-analytics/sop-execution-log-repo
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { SopExecutionLogRow } from './types';

/**
 * Insert a single step execution log entry.
 * Returns the new log row ID.
 * Throws on D1 constraint violation.
 */
export async function logStepExecution(params: {
  executionId: string;
  sopTemplateId: string;
  userId: string;
  stepIndex: number;
  stepName: string;
  status: SopExecutionLogRow['status'];
  inputHash?: string;
  outputSummary?: string;
  durationMs?: number;
  costCents?: number;
  errorMessage?: string;
}): Promise<string> {
  const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;;
  const id = crypto.randomUUID();
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO sop_execution_logs
         (id, execution_id, sop_template_id, user_id, step_index, step_name,
          status, input_hash, output_summary, duration_ms, cost_cents,
          error_message, created_at)
       VALUES
         (?1, ?2, ?3, ?4, ?5, ?6,
          ?7, ?8, ?9, ?10, ?11,
          ?12, ?13)`,
    )
    .bind(
      id,
      params.executionId,
      params.sopTemplateId,
      params.userId,
      params.stepIndex,
      params.stepName,
      params.status,
      params.inputHash ?? null,
      params.outputSummary ?? null,
      params.durationMs ?? null,
      params.costCents ?? 0,
      params.errorMessage ?? null,
      now,
    )
    .run();

  logger.info('[SopLogRepo] Step logged', {
    id,
    executionId: params.executionId,
    stepIndex: params.stepIndex,
    status: params.status,
  });

  return id;
}

/**
 * Retrieve all step logs for an execution, ordered by step_index ascending.
 * Returns empty array on error.
 */
export async function getExecutionSteps(
  executionId: string,
): Promise<SopExecutionLogRow[]> {
  try {
    const _db = getD1();
  if (!_db) throw new Error('D1 binding not available');
  const db = _db;;
    const result = await db
      .prepare(
        `SELECT id, execution_id, sop_template_id, user_id, step_index, step_name,
                status, input_hash, output_summary, duration_ms, cost_cents,
                error_message, created_at
         FROM sop_execution_logs
         WHERE execution_id = ?1
         ORDER BY step_index ASC`,
      )
      .bind(executionId)
      .all<SopExecutionLogRow>();

    return result.results ?? [];
  } catch (err) {
    logger.error('[SopLogRepo] getExecutionSteps failed', {
      executionId,
      error: getErrorMessage(err),
    });
    return [];
  }
}
