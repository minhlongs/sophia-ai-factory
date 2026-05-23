/**
 * Internal helpers for multi-agent-coordinator: row mappers and timestamp util.
 * Not exported from public tree API — imported only by multi-agent-coordinator.ts.
 *
 * Layer: tree
 */

import type { AgentRole, AgentSession, AgentTaskAssignment } from '@/seed/types/multi-agent'

export function rowToSession(row: Record<string, unknown>): AgentSession {
  return {
    id: row.id as string,
    executionId: row.execution_id as string,
    supervisorAgent: row.supervisor_agent as string,
    status: row.status as AgentSession['status'],
    workerCount: row.worker_count as number,
    completedCount: row.completed_count as number,
    failedCount: row.failed_count as number,
    config: row.config_json
      ? (JSON.parse(row.config_json as string) as Record<string, unknown>)
      : undefined,
    startedAt: row.started_at as number | undefined,
    completedAt: row.completed_at as number | undefined,
    createdAt: row.created_at as number,
  }
}

export function rowToTask(row: Record<string, unknown>): AgentTaskAssignment {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    agentRole: row.agent_role as AgentRole,
    stepIndex: row.step_index as number,
    status: row.status as AgentTaskAssignment['status'],
    input: row.input_json
      ? (JSON.parse(row.input_json as string) as Record<string, unknown>)
      : undefined,
    output: row.output_json
      ? (JSON.parse(row.output_json as string) as Record<string, unknown>)
      : undefined,
    errorMessage: row.error_message as string | undefined,
    startedAt: row.started_at as number | undefined,
    completedAt: row.completed_at as number | undefined,
    createdAt: row.created_at as number,
  }
}

/** Unix epoch seconds */
export function nowSec(): number {
  return Math.floor(Date.now() / 1000)
}

/**
 * Build the SQL fragment that settles a session when all workers are done.
 * Used by both completeTask and failTask to keep the coordinator under 200 lines.
 *
 * @param incrementField - column to increment: 'completed_count' or 'failed_count'
 */
export function buildSettleSessionStmt(
  db: D1Database,
  incrementField: 'completed_count' | 'failed_count',
  ts: number,
  sessionId: string,
): D1PreparedStatement {
  // Determine the OTHER field to add in the settled-check arithmetic
  const other = incrementField === 'completed_count' ? 'failed_count' : 'completed_count'
  return db
    .prepare(
      `UPDATE agent_execution_sessions
       SET ${incrementField} = ${incrementField} + 1,
           status = CASE WHEN (${incrementField} + 1 + ${other}) >= worker_count THEN 'completed' ELSE status END,
           completed_at = CASE WHEN (${incrementField} + 1 + ${other}) >= worker_count THEN ? ELSE completed_at END
       WHERE id = ?`,
    )
    .bind(ts, sessionId)
}
