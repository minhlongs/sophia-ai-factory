/**
 * Agent Factory — TypeScript interfaces
 * Tables: agent_teams, agents, agent_tasks, agent_logs
 */

export type AgentRole = 'CEO' | 'Developer';
export type AgentTaskStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface AgentTeam {
  id: string;
  orgId: string;
  name: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  teamId: string;
  role: AgentRole;
  name: string;
  systemPrompt: string;
  model: string;
  enabled: boolean;
  createdAt: string;
}

export interface AgentTask {
  id: string;
  orgId: string;
  agentId: string;
  input: string;
  output: string | null;
  status: AgentTaskStatus;
  errorMessage: string | null;
  tokensUsed: number;
  costUsd: number;
  createdAt: string;
  completedAt: string | null;
}

export interface AgentLog {
  id: string;
  taskId: string;
  action: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

/** Raw D1 row shapes (snake_case from DB) */
export interface AgentTeamRow {
  id: string;
  org_id: string;
  name: string;
  config: string;
  created_at: string;
  updated_at: string;
}

export interface AgentRow {
  id: string;
  team_id: string;
  role: AgentRole;
  name: string;
  system_prompt: string;
  model: string;
  enabled: number;
  created_at: string;
}

export interface AgentTaskRow {
  id: string;
  org_id: string;
  agent_id: string;
  input: string;
  output: string | null;
  status: AgentTaskStatus;
  error_message: string | null;
  tokens_used: number;
  cost_usd: number;
  created_at: string;
  completed_at: string | null;
}

export interface AgentLogRow {
  id: string;
  task_id: string;
  action: string;
  payload: string;
  created_at: string;
}
