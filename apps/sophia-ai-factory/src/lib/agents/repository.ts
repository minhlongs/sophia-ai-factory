/**
 * Agent Factory — D1 CRUD repository
 * Uses createServerClient() sync pattern.
 */

import { createServerClient } from '@/lib/db/client';
import type {
  AgentTeam, Agent, AgentTask, AgentLog,
  AgentTeamRow, AgentRow, AgentTaskRow, AgentLogRow,
  AgentTaskStatus,
} from './types';

// ── Row mappers ────────────────────────────────────────────────────────────

function mapTeam(row: AgentTeamRow): AgentTeam {
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    config: safeParseJson(row.config),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAgent(row: AgentRow): Agent {
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

function mapTask(row: AgentTaskRow): AgentTask {
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

function safeParseJson(value: string): Record<string, unknown> {
  try { return JSON.parse(value) as Record<string, unknown>; }
  catch { return {}; }
}

// ── Team ──────────────────────────────────────────────────────────────────

export async function getTeamByOrgId(orgId: string): Promise<AgentTeam | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from('agent_teams')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();
  if (error || !data) return null;
  return mapTeam(data as AgentTeamRow);
}

export async function createTeam(orgId: string, name = 'My AI Company'): Promise<AgentTeam> {
  const db = createServerClient();
  const { data, error } = await db
    .from('agent_teams')
    .insert({ org_id: orgId, name, config: '{}' })
    .select()
    .single();
  if (error || !data) throw new Error(`createTeam failed: ${String(error)}`);
  return mapTeam(data as AgentTeamRow);
}

export async function getOrCreateTeam(orgId: string): Promise<AgentTeam> {
  const existing = await getTeamByOrgId(orgId);
  if (existing) return existing;
  return createTeam(orgId);
}

// ── Agents ────────────────────────────────────────────────────────────────

export async function listAgents(teamId: string): Promise<Agent[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from('agents')
    .select('*')
    .eq('team_id', teamId)
    .eq('enabled', 1);
  if (error || !data) return [];
  return (data as AgentRow[]).map(mapAgent);
}

export async function createAgent(params: {
  teamId: string;
  role: 'CEO' | 'Developer';
  name: string;
  systemPrompt: string;
  model?: string;
}): Promise<Agent> {
  const db = createServerClient();
  const { data, error } = await db
    .from('agents')
    .insert({
      team_id: params.teamId,
      role: params.role,
      name: params.name,
      system_prompt: params.systemPrompt,
      model: params.model ?? 'openai/gpt-4o-mini',
      enabled: 1,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`createAgent failed: ${String(error)}`);
  return mapAgent(data as AgentRow);
}

export async function getAgentById(agentId: string): Promise<Agent | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .maybeSingle();
  if (error || !data) return null;
  return mapAgent(data as AgentRow);
}

// ── Tasks ─────────────────────────────────────────────────────────────────

export async function createTask(params: {
  orgId: string;
  agentId: string;
  input: string;
}): Promise<AgentTask> {
  const db = createServerClient();
  const { data, error } = await db
    .from('agent_tasks')
    .insert({ org_id: params.orgId, agent_id: params.agentId, input: params.input, status: 'queued' })
    .select()
    .single();
  if (error || !data) throw new Error(`createTask failed: ${String(error)}`);
  return mapTask(data as AgentTaskRow);
}

export async function getTask(taskId: string, orgId: string): Promise<AgentTask | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from('agent_tasks')
    .select('*')
    .eq('id', taskId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (error || !data) return null;
  return mapTask(data as AgentTaskRow);
}

export async function updateTaskStatus(taskId: string, status: AgentTaskStatus): Promise<void> {
  const db = createServerClient();
  await db.from('agent_tasks').update({ status }).eq('id', taskId);
}

export async function updateTaskResult(taskId: string, params: {
  output: string;
  tokensUsed: number;
  costUsd: number;
  status: AgentTaskStatus;
  errorMessage?: string;
}): Promise<void> {
  const db = createServerClient();
  await db.from('agent_tasks').update({
    output: params.output,
    tokens_used: params.tokensUsed,
    cost_usd: params.costUsd,
    status: params.status,
    error_message: params.errorMessage ?? null,
    completed_at: new Date().toISOString(),
  }).eq('id', taskId);
}

// ── Logs ──────────────────────────────────────────────────────────────────

export async function appendLog(params: {
  taskId: string;
  action: string;
  payload?: Record<string, unknown>;
}): Promise<AgentLog> {
  const db = createServerClient();
  const { data, error } = await db
    .from('agent_logs')
    .insert({
      task_id: params.taskId,
      action: params.action,
      payload: JSON.stringify(params.payload ?? {}),
    })
    .select()
    .single();
  if (error || !data) throw new Error(`appendLog failed: ${String(error)}`);
  const row = data as AgentLogRow;
  return {
    id: row.id,
    taskId: row.task_id,
    action: row.action,
    payload: safeParseJson(row.payload),
    createdAt: row.created_at,
  };
}
