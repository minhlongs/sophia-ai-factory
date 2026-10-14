import type {
  AgentTeam, Agent, AgentTask, AgentLog,
  AgentTeamRow, AgentRow, AgentTaskRow, AgentLogRow,
} from '../types';

export function safeParseJson(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function mapTeam(row: AgentTeamRow): AgentTeam {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    config: safeParseJson(row.config),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    teamId: row.team_id,
    role: row.role,
    name: row.name,
    systemPrompt: row.system_prompt,
    model: row.model,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
  };
}

export function mapTask(row: AgentTaskRow): AgentTask {
  return {
    id: row.id,
    orgId: row.org_id,
    agentId: row.agent_id,
    input: row.input,
    output: row.output,
    status: row.status,
    errorMessage: row.error_message,
    tokensUsed: row.tokens_used,
    costUsd: row.cost_usd,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export function mapLog(row: AgentLogRow): AgentLog {
  return {
    id: row.id,
    taskId: row.task_id,
    action: row.action,
    payload: safeParseJson(row.payload),
    createdAt: row.created_at,
  };
}
