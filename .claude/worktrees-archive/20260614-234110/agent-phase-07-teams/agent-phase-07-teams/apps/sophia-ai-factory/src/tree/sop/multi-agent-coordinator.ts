/**
 * Multi-Agent Coordinator — stub for LangGraph-based supervisor/worker orchestration.
 * Persists session + task state to D1; LangGraph wiring is deferred.
 *
 * Layer: tree (domain-reusable, imports seed only)
 */

import { getD1Raw } from '@/seed/db/client'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'
import type { AgentRole, AgentSessionWithTasks } from '@/seed/types/multi-agent'
import { rowToSession, rowToTask, nowSec, buildSettleSessionStmt } from './multi-agent-coordinator-helpers'
export { saveCheckpoint, loadCheckpoint } from './multi-agent-coordinator-checkpoint'

// ---------------------------------------------------------------------------
// createSession
// ---------------------------------------------------------------------------

/**
 * Create a new agent execution session.
 * Returns the generated session ID.
 */
export async function createSession(params: {
  executionId: string
  supervisorAgent?: string
  config?: Record<string, unknown>
}): Promise<string> {
  const db = await getD1Raw()
  const id = crypto.randomUUID()
  const ts = nowSec()

  try {
    await db
      .prepare(
        `INSERT INTO agent_execution_sessions
         (id, execution_id, supervisor_agent, status, worker_count, completed_count, failed_count, config_json, created_at)
         VALUES (?, ?, ?, 'pending', 0, 0, 0, ?, ?)`,
      )
      .bind(
        id,
        params.executionId,
        params.supervisorAgent ?? 'default',
        params.config ? JSON.stringify(params.config) : null,
        ts,
      )
      .run()

    logger.info('multi-agent: session created', { sessionId: id })
    return id
  } catch (err) {
    logger.error('multi-agent: createSession failed', { error: getErrorMessage(err) })
    throw err
  }
}

// ---------------------------------------------------------------------------
// assignTask
// ---------------------------------------------------------------------------

/**
 * Assign a task to a worker agent within a session.
 * Increments session worker_count and transitions session to 'running'.
 * Returns the generated task ID.
 */
export async function assignTask(params: {
  sessionId: string
  agentRole: AgentRole
  stepIndex: number
  input?: Record<string, unknown>
}): Promise<string> {
  const db = await getD1Raw()
  const taskId = crypto.randomUUID()
  const ts = nowSec()

  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO agent_task_assignments
           (id, session_id, agent_role, step_index, status, input_json, created_at)
           VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
        )
        .bind(taskId, params.sessionId, params.agentRole, params.stepIndex,
          params.input ? JSON.stringify(params.input) : null, ts),
      db
        .prepare(
          `UPDATE agent_execution_sessions
           SET worker_count = worker_count + 1, status = 'running',
               started_at = COALESCE(started_at, ?)
           WHERE id = ?`,
        )
        .bind(ts, params.sessionId),
    ])

    logger.info('multi-agent: task assigned', { taskId, role: params.agentRole })
    return taskId
  } catch (err) {
    logger.error('multi-agent: assignTask failed', { error: getErrorMessage(err) })
    throw err
  }
}

// ---------------------------------------------------------------------------
// completeTask / failTask
// ---------------------------------------------------------------------------

/**
 * Mark a task as completed with its output.
 * Increments session completed_count; settles session when all workers are done.
 */
export async function completeTask(taskId: string, output: Record<string, unknown>): Promise<void> {
  const db = await getD1Raw()
  const ts = nowSec()

  try {
    const taskRow = await db
      .prepare(`SELECT session_id FROM agent_task_assignments WHERE id = ?`)
      .bind(taskId)
      .first<{ session_id: string }>()

    if (!taskRow) throw new Error(`Task not found: ${taskId}`)

    await db.batch([
      db
        .prepare(`UPDATE agent_task_assignments SET status = 'completed', output_json = ?, completed_at = ?, checkpoint_json = NULL WHERE id = ?`)
        .bind(JSON.stringify(output), ts, taskId),
      buildSettleSessionStmt(db, 'completed_count', ts, taskRow.session_id),
    ])

    logger.info('multi-agent: task completed', { taskId })
  } catch (err) {
    logger.error('multi-agent: completeTask failed', { error: getErrorMessage(err) })
    throw err
  }
}

/**
 * Mark a task as failed with an error message.
 * Increments session failed_count; settles session when all workers are done.
 */
export async function failTask(taskId: string, errorMessage: string): Promise<void> {
  const db = await getD1Raw()
  const ts = nowSec()

  try {
    const taskRow = await db
      .prepare(`SELECT session_id FROM agent_task_assignments WHERE id = ?`)
      .bind(taskId)
      .first<{ session_id: string }>()

    if (!taskRow) throw new Error(`Task not found: ${taskId}`)

    await db.batch([
      db
        .prepare(`UPDATE agent_task_assignments SET status = 'failed', error_message = ?, completed_at = ? WHERE id = ?`)
        .bind(errorMessage, ts, taskId),
      buildSettleSessionStmt(db, 'failed_count', ts, taskRow.session_id),
    ])

    logger.warn('multi-agent: task failed', { taskId, errorMessage })
  } catch (err) {
    logger.error('multi-agent: failTask failed', { error: getErrorMessage(err) })
    throw err
  }
}

// ---------------------------------------------------------------------------
// getSessionStatus / cancelSession
// ---------------------------------------------------------------------------

/**
 * Return the session record with all its task assignments.
 */
export async function getSessionStatus(sessionId: string): Promise<AgentSessionWithTasks> {
  const db = await getD1Raw()

  try {
    const [sessionRow, taskResults] = await Promise.all([
      db.prepare(`SELECT * FROM agent_execution_sessions WHERE id = ?`).bind(sessionId).first<Record<string, unknown>>(),
      db.prepare(`SELECT * FROM agent_task_assignments WHERE session_id = ? ORDER BY step_index ASC`)
        .bind(sessionId).all<Record<string, unknown>>(),
    ])

    if (!sessionRow) throw new Error(`Session not found: ${sessionId}`)

    return {
      ...rowToSession(sessionRow),
      tasks: (taskResults.results ?? []).map(rowToTask),
    }
  } catch (err) {
    logger.error('multi-agent: getSessionStatus failed', { error: getErrorMessage(err) })
    throw err
  }
}

/**
 * Cancel a session — marks all pending/running tasks as 'cancelled' and the session itself.
 */
export async function cancelSession(sessionId: string): Promise<void> {
  const db = await getD1Raw()
  const ts = nowSec()

  try {
    await db.batch([
      db
        .prepare(
          `UPDATE agent_task_assignments
           SET status = 'cancelled', completed_at = ?
           WHERE session_id = ? AND status IN ('pending', 'running')`,
        )
        .bind(ts, sessionId),
      db
        .prepare(
          `UPDATE agent_execution_sessions
           SET status = 'cancelled', completed_at = ?
           WHERE id = ? AND status NOT IN ('completed', 'cancelled')`,
        )
        .bind(ts, sessionId),
    ])

    logger.info('multi-agent: session cancelled', { sessionId })
  } catch (err) {
    logger.error('multi-agent: cancelSession failed', { error: getErrorMessage(err) })
    throw err
  }
}
