/**
 * SOP Execution repository functions (run state machine)
 *
 * @module seed/db/repositories/sop/execution-repo
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export { getExecution, getUserExecutions } from './execution-queries';

/**
 * Create a new SOP execution row in 'pending' status.
 * Returns the new execution ID.
 */
export async function createExecution(params: {
  userId: string;
  orgId: string;
  sopTemplateId: string;
  installationId?: string;
  inputJson: string;
  totalSteps: number;
}): Promise<string> {
  const db = await getD1();
  if (!db) throw new Error('D1 binding not available');
  const id = crypto.randomUUID();
  const now = Date.now();
  const emptyStepResults = '[]';

  await db
    .prepare(
      `INSERT INTO sop_executions
         (id, user_id, org_id, sop_template_id, installation_id,
          status, input_json, output_json, error_message,
          current_step, total_steps, step_results, credits_used, started_at, completed_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 'pending', ?6, NULL, NULL, 0, ?7, ?8, 0, ?9, NULL)`,
    )
    .bind(
      id, params.userId, params.orgId, params.sopTemplateId,
      params.installationId ?? null, params.inputJson, params.totalSteps, emptyStepResults, now,
    )
    .run();

  logger.info('[SopRepo] Execution created', { id, sopTemplateId: params.sopTemplateId });
  return id;
}

/**
 * Update the current step and step results of a running execution.
 * Optionally transitions status (defaults to 'running' if not provided).
 */
export async function updateExecutionStep(
  executionId: string,
  currentStep: number,
  stepResults: string,
  status?: string,
): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('D1 binding not available');
  const resolvedStatus = status ?? 'running';

  await db
    .prepare(
      `UPDATE sop_executions SET current_step = ?2, step_results = ?3, status = ?4 WHERE id = ?1`,
    )
    .bind(executionId, currentStep, stepResults, resolvedStatus)
    .run();
}

/**
 * Mark an execution as completed.
 * Sets output_json, credits_used, status='completed', and completed_at.
 */
export async function completeExecution(
  executionId: string,
  outputJson: string,
  creditsUsed: number,
): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('D1 binding not available');
  const now = Date.now();

  await db
    .prepare(
      `UPDATE sop_executions
       SET status = 'completed', output_json = ?2, credits_used = ?3, completed_at = ?4, error_message = NULL
       WHERE id = ?1`,
    )
    .bind(executionId, outputJson, creditsUsed, now)
    .run();

  logger.info('[SopRepo] Execution completed', { executionId, creditsUsed });
}

/**
 * Mark an execution as failed with an error message.
 * Sets status='failed' and records the error.
 */
export async function failExecution(
  executionId: string,
  errorMessage: string,
): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('D1 binding not available');
  const now = Date.now();

  await db
    .prepare(
      `UPDATE sop_executions SET status = 'failed', error_message = ?2, completed_at = ?3 WHERE id = ?1`,
    )
    .bind(executionId, errorMessage, now)
    .run();

  logger.warn('[SopRepo] Execution failed', { executionId, errorMessage });
}
