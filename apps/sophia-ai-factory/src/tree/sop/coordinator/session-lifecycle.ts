/**
 * Multi-Agent Coordinator — Session Lifecycle
 *
 * Layer: tree (domain-reusable, imports seed only)
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { AgentSessionWithTasks } from '@/seed/types/multi-agent';
import { rowToSession, rowToTask, nowSec } from '../multi-agent-coordinator-helpers';

/**
 * Create a new agent execution session.
 * Returns the generated session ID.
 */
export async function createSession(params: {
  executionId: string;
  supervisorAgent?: string;
  config?: Record<string, unknown>;
}): Promise<string> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const id = crypto.randomUUID();
  const ts = nowSec();

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
      .run();

    logger.info('multi-agent: session created', { sessionId: id });
    return id;
  } catch (err) {
    logger.error('multi-agent: createSession failed', { error: getErrorMessage(err) });
    throw err;
  }
}

/**
 * Return the session record with all its task assignments.
 */
export async function getSessionStatus(sessionId: string): Promise<AgentSessionWithTasks> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');

  try {
    const [sessionRow, taskResults] = await Promise.all([
      db.prepare(`SELECT * FROM agent_execution_sessions WHERE id = ?`).bind(sessionId).first<Record<string, unknown>>(),
      db.prepare(`SELECT * FROM agent_task_assignments WHERE session_id = ? ORDER BY step_index ASC`)
        .bind(sessionId).all<Record<string, unknown>>(),
    ]);

    if (!sessionRow) throw new Error(`Session not found: ${sessionId}`);

    return {
      ...rowToSession(sessionRow),
      tasks: (taskResults.results ?? []).map(rowToTask),
    };
  } catch (err) {
    logger.error('multi-agent: getSessionStatus failed', { error: getErrorMessage(err) });
    throw err;
  }
}

/**
 * Cancel a session — marks all pending/running tasks as 'cancelled' and the session itself.
 */
export async function cancelSession(sessionId: string): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const ts = nowSec();

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
    ]);

    logger.info('multi-agent: session cancelled', { sessionId });
  } catch (err) {
    logger.error('multi-agent: cancelSession failed', { error: getErrorMessage(err) });
    throw err;
  }
}
