/**
 * Agent Domain Types — AI agent orchestration in Sophia AI Factory
 * Layer: forest
 * Purpose: Defines agent, team, task, and log types for the agent orchestration system
 */

// ── Agent Role & Status ─────────────────────────────────────────────────────

export type AgentRole = 'CEO' | 'CTO' | 'CSO' | 'CMO' | 'COO' | 'Developer' | 'QA' | 'Ops' | 'Marketing';

export type AgentTaskStatus = 'queued' | 'running' | 'completed' | 'failed';

// ── Core Interfaces ────────────────────────────────────────────────────────

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
  output: string;
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

// ── Database Row Interfaces (snake_case) ────────────────────────────────────

export interface AgentTeamRow {
  id: string;
  org_id: string;
  name: string;
  config: string; // JSON string
  created_at: string;
  updated_at: string;
}

export interface AgentRow {
  id: string;
  team_id: string;
  role: string;
  name: string;
  system_prompt: string;
  model: string;
  enabled: number; // 0 or 1
  created_at: string;
}

export interface AgentTaskRow {
  id: string;
  org_id: string;
  agent_id: string;
  input: string;
  output: string | null;
  status: string;
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
  payload: string; // JSON string
  created_at: string;
}

// ── Health Monitoring Types ────────────────────────────────────────────────

export interface AgentRoleHealth {
  role: AgentRole;
  totalCount: number;
  successRate: number;
  lastFailureAt: string | null;
}

export interface AgentHealthSummary {
  roles: AgentRoleHealth[];
  totalErrors24h: number;
  resolvedAt: string;
}
