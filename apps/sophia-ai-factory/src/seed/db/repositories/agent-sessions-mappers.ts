/**
 * Raw D1 row interfaces and domain mappers for agent sessions repository.
 * @module seed/db/repositories/agent-sessions-mappers
 */

import type {
  AgentSession,
  AgentTaskAssignment,
  SOPAgentRole,
  AgentStatus,
} from '@/seed/types/multi-agent';

export interface RawSessionRow {
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

export interface RawTaskRow {
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

export function mapSession(r: RawSessionRow): AgentSession {
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

export function mapTask(r: RawTaskRow): AgentTaskAssignment {
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
