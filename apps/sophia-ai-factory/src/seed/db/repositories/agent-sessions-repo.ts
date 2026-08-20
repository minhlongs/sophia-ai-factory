/**
 * Repository for agent execution sessions and task assignments.
 * Tables: agent_execution_sessions, agent_task_assignments.
 * @module seed/db/repositories/agent-sessions-repo
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { AgentSession, AgentTaskAssignment, SOPAgentRole, AgentStatus } from '@/seed/types/multi-agent';

// ── Raw row types ─────────────────────────────────────────────────────────────

interface RawSessionRow {
  id: string;
  execution_id: string;
  supervisor_agent: string;
  status: string;
  worker_count: number;
  completed_count: number;
  failed_count: number;
  config_json: string | null;
  started_at: number | null;
  completed_at: number | null;
  created_at: number;
}

interface RawTaskRow {
  id: string;
  session_id: string;
  agent_role: string;
  step_index: number;
  status: string;
  input_json: string | null;
  output_json: string | null;
  error_message: string | null;
  started_at: number | null;
  completed_at: number | null;
  created_at: number;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapSession(r: RawSessionRow): AgentSession {
  return {
    id: r.id,
    executionId: r.execution_id,
    supervisorAgent: r.supervisor_agent,
    status: r.status as AgentStatus,
    workerCount: r.worker_count,
    completedCount: r.completed_count,
    failedCount: r.failed_count,
    config: r.config_json ? (JSON.parse(r.config_json) as Record<string, unknown>) : undefined,
    startedAt: r.started_at ?? undefined,
    completedAt: r.completed_at ?? undefined,
    createdAt: r.created_at,
  };
}

function mapTask(r: RawTaskRow): AgentTaskAssignment {
  return {
    id: r.id,
    sessionId: r.session_id,
    agentRole: r.agent_role as SOPAgentRole,
    stepIndex: r.step_index,
    status: r.status as AgentStatus,
    input: r.input_json ? (JSON.parse(r.input_json) as Record<string, unknown>) : undefined,
    output: r.output_json ? (JSON.parse(r.output_json) as Record<string, unknown>) : undefined,
    errorMessage: r.error_message ?? undefined,
    startedAt: r.started_at ?? undefined,
    completedAt: r.completed_at ?? undefined,
    createdAt: r.created_at,
  };
}

// ── Read ──────────────────────────────────────────────────────────────────────

/** Fetch recent sessions ordered by created_at DESC. Returns [] on error. */
export async function getRecentSessions(limit = 20): Promise<AgentSession[]> {
  try {
    const db = await getD1()
    if (!db) throw new Error('D1 database binding not available')
    const result = await db
      .prepare(
        `SELECT id, execution_id, supervisor_agent, status, worker_count,
                completed_count, failed_count, config_json, started_at, completed_at, created_at
         FROM agent_execution_sessions
         ORDER BY created_at DESC LIMIT ?1`,
      )
      .bind(limit)
      .all<RawSessionRow>();
    return (result.results ?? []).map(mapSession);
  } catch (err) {
    logger.error('[AgentSessionsRepo] getRecentSessions failed', { error: getErrorMessage(err) });
    return [];
  }
}

/** Fetch all task assignments for a session. Returns [] on error. */
export async function getTasksForSession(sessionId: string): Promise<AgentTaskAssignment[]> {
  try {
    const db = await getD1()
    if (!db) throw new Error('D1 database binding not available')
    const result = await db
      .prepare(
        `SELECT id, session_id, agent_role, step_index, status, input_json,
                output_json, error_message, started_at, completed_at, created_at
         FROM agent_task_assignments
         WHERE session_id = ?1 ORDER BY step_index ASC`,
      )
      .bind(sessionId)
      .all<RawTaskRow>();
    return (result.results ?? []).map(mapTask);
  } catch (err) {
    logger.error('[AgentSessionsRepo] getTasksForSession failed', { sessionId, error: getErrorMessage(err) });
    return [];
  }
}

/** Fetch all tasks for multiple sessions in one query. Returns map sessionId → tasks. */
export async function getTasksForSessions(sessionIds: string[]): Promise<Record<string, AgentTaskAssignment[]>> {
  if (sessionIds.length === 0) return {};
  try {
    const db = await getD1()
    if (!db) throw new Error('D1 database binding not available')
    const placeholders = sessionIds.map((_, i) => `?${i + 1}`).join(',');
    const result = await db
      .prepare(
        `SELECT id, session_id, agent_role, step_index, status, input_json,
                output_json, error_message, started_at, completed_at, created_at
         FROM agent_task_assignments
         WHERE session_id IN (${placeholders})
         ORDER BY step_index ASC`,
      )
      .bind(...sessionIds)
      .all<RawTaskRow>();

    const grouped: Record<string, AgentTaskAssignment[]> = {};
    for (const row of result.results ?? []) {
      const task = mapTask(row);
      if (!grouped[task.sessionId]) grouped[task.sessionId] = [];
      grouped[task.sessionId].push(task);
    }
    return grouped;
  } catch (err) {
    logger.error('[AgentSessionsRepo] getTasksForSessions failed', { error: getErrorMessage(err) });
    return {};
  }
}

/** Get aggregate session counts. */
export async function getSessionStats(): Promise<{ active: number; completed: number; failed: number }> {
  try {
    const db = await getD1()
    if (!db) throw new Error('D1 database binding not available')
    const result = await db
      .prepare(
        `SELECT status, COUNT(*) as cnt FROM agent_execution_sessions GROUP BY status`,
      )
      .all<{ status: string; cnt: number }>();

    const stats = { active: 0, completed: 0, failed: 0 };
    for (const row of result.results ?? []) {
      if (row.status === 'running' || row.status === 'pending') stats.active += row.cnt;
      else if (row.status === 'completed') stats.completed = row.cnt;
      else if (row.status === 'failed') stats.failed = row.cnt;
    }
    return stats;
  } catch (err) {
    logger.error('[AgentSessionsRepo] getSessionStats failed', { error: getErrorMessage(err) });
    return { active: 0, completed: 0, failed: 0 };
  }
}
