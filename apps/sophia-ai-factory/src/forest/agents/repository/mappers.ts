/**
 * Agent Repository Mappers
 * Layer: forest
 *
 * @module forest/agents/repository/mappers
 */

import type {
  AgentTeam,
  Agent,
  AgentTask,
  AgentLog,
  AgentTeamRow,
  AgentRow,
  AgentTaskRow,
  AgentLogRow,
} from '../types';

/**
 * Maps an AgentTeamRow to an AgentTeam
 */
export function mapAgentTeam(row: AgentTeamRow): AgentTeam {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    config: JSON.parse(row.config || '{}'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Maps an AgentRow to an Agent
 */
export function mapAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    teamId: row.team_id,
    role: row.role as Agent['role'],
    name: row.name,
    systemPrompt: row.system_prompt,
    model: row.model,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
  };
}

/**
 * Maps an AgentTaskRow to an AgentTask
 */
export function mapTask(row: AgentTaskRow): AgentTask {
  return {
    id: row.id,
    orgId: row.org_id,
    agentId: row.agent_id,
    input: row.input,
    output: row.output || '',
    status: row.status as AgentTask['status'],
    errorMessage: row.error_message || null,
    tokensUsed: row.tokens_used,
    costUsd: row.cost_usd,
    createdAt: row.created_at,
    completedAt: row.completed_at || null,
  };
}

/**
 * Maps an AgentLogRow to an AgentLog
 */
export function mapLog(row: AgentLogRow): AgentLog {
  return {
    id: row.id,
    taskId: row.task_id,
    action: row.action,
    payload: JSON.parse(row.payload || '{}'),
    createdAt: row.created_at,
  };
}
