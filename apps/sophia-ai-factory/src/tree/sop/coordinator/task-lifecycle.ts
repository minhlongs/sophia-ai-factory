/**
 * Multi-Agent Coordinator — Task Lifecycle
 *
 * Layer: tree (domain-reusable, imports seed only)
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { SOPAgentRole } from '@/seed/types/multi-agent';
import { nowSec, buildSettleSessionStmt } from '../multi-agent-coordinator-helpers';

/**
 * Assign a task to a worker agent within a session.
 * Increments session worker_count and transitions session to 'running'.
 * Returns the generated task ID.
 */
export async function assignTask(params: {
  sessionId: string;
  agentRole: SOPAgentRole;
  stepIndex: number;
  input?: Record<string, unknown>;
}): Promise<string> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const taskId = crypto.randomUUID();
  const ts = nowSec();

  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO agent_task_assignments
           (id, session_id, agent_role, step_index, status, input_json, created_at)
           VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
        )
        .bind(
          taskId,
          params.sessionId,
          params.agentRole,
          params.stepIndex,
          params.input ? JSON.stringify(params.input) : null,
          ts,
        ),
      db
        .prepare(
          `UPDATE agent_execution_sessions
           SET worker_count = worker_count + 1, status = 'running',
               started_at = COALESCE(started_at, ?)
           WHERE id = ?`,
        )
        .bind(ts, params.sessionId),
    ]);

    logger.info('multi-agent: task assigned', { taskId, role: params.agentRole });
    return taskId;
  } catch (err) {
    logger.error('multi-agent: assignTask failed', { error: getErrorMessage(err) });
    throw err;
  }
}

/**
 * Mark a task as completed with its output.
 * Increments session completed_count; settles session when all workers are done.
 */
export async function completeTask(taskId: string, output: Record<string, unknown>): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const ts = nowSec();

  try {
    const taskRow = await db
      .prepare(`SELECT session_id FROM agent_task_assignments WHERE id = ?`)
      .bind(taskId)
      .first<{ session_id: string }>();

    if (!taskRow) throw new Error(`Task not found: ${taskId}`);

    await db.batch([
      db
        .prepare(
          `UPDATE agent_task_assignments SET status = 'completed', output_json = ?, completed_at = ?, checkpoint_json = NULL WHERE id = ?`,
        )
        .bind(JSON.stringify(output), ts, taskId),
      buildSettleSessionStmt(db, 'completed_count', ts, taskRow.session_id),
    ]);

    logger.info('multi-agent: task completed', { taskId });
  } catch (err) {
    logger.error('multi-agent: completeTask failed', { error: getErrorMessage(err) });
    throw err;
  }
}

/**
 * Mark a task as failed with an error message.
 * Increments session failed_count; settles session when all workers are done.
 */
export async function failTask(taskId: string, errorMessage: string): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const ts = nowSec();

  try {
    const taskRow = await db
      .prepare(`SELECT session_id FROM agent_task_assignments WHERE id = ?`)
      .bind(taskId)
      .first<{ session_id: string }>();

    if (!taskRow) throw new Error(`Task not found: ${taskId}`);

    await db.batch([
      db
        .prepare(
          `UPDATE agent_task_assignments SET status = 'failed', error_message = ?, completed_at = ? WHERE id = ?`,
        )
        .bind(errorMessage, ts, taskId),
      buildSettleSessionStmt(db, 'failed_count', ts, taskRow.session_id),
    ]);

    logger.warn('multi-agent: task failed', { taskId, errorMessage });
  } catch (err) {
    logger.error('multi-agent: failTask failed', { error: getErrorMessage(err) });
    throw err;
  }
}
