/**
 * Agent Repository — Data access layer for AI agents
 * Layer: forest
 * Purpose: Provides CRUD operations for agents, teams, tasks, and logs using D1
 */

import { createServerClient } from '@/seed/db/client';
import type {
  AgentTeam,
  Agent,
  AgentTask,
  AgentLog,
  AgentTeamRow,
  AgentRow,
  AgentTaskRow,
  AgentLogRow,
} from './types';

/**
 * Maps an AgentTeamRow to an AgentTeam
 */
function mapAgentTeam(row: AgentTeamRow): AgentTeam {
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
function mapAgent(row: AgentRow): Agent {
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
function mapTask(row: AgentTaskRow): AgentTask {
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
function mapLog(row: AgentLogRow): AgentLog {
  return {
    id: row.id,
    taskId: row.task_id,
    action: row.action,
    payload: JSON.parse(row.payload || '{}'),
    createdAt: row.created_at,
  };
}

/**
 * Get a team by organization ID
 */
export async function getTeamByOrgId(orgId: string): Promise<AgentTeam | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from<AgentTeamRow>('agent_teams')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (error || !data) return null;
  return mapAgentTeam(data);
}

/**
 * Get an agent by ID
 */
export async function getAgentById(agentId: string): Promise<Agent | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from<AgentRow>('agents')
    .select('*')
    .eq('id', agentId)
    .single();

  if (error || !data) return null;
  return mapAgent(data);
}

/**
 * Get a task by ID
 */
export async function getTask(taskId: string, orgId: string): Promise<AgentTask | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from<AgentTaskRow>('agent_tasks')
    .select('*')
    .eq('id', taskId)
    .eq('org_id', orgId)
    .single();

  if (error || !data) return null;
  return mapTask(data);
}

/**
 * List all agents for a team
 */
export async function listAgents(teamId: string): Promise<Agent[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from<AgentRow>('agents')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data.map(mapAgent);
}

/**
 * Append a log entry for a task
 */
export async function appendLog(data: {
  taskId: string;
  action: string;
  payload: Record<string, unknown>;
}): Promise<AgentLog> {
  const db = createServerClient();
  const payloadStr = JSON.stringify(data.payload);

  const { data: insertData, error } = await db
    .from<AgentLogRow>('agent_logs')
    .insert({
      task_id: data.taskId,
      action: data.action,
      payload: payloadStr,
    })
    .select('*')
    .single();

  if (error || !insertData) throw new Error('Failed to insert log');
  return mapLog(insertData);
}

/**
 * Update task status
 */
export async function updateTaskStatus(
  taskId: string,
  orgId: string,
  updates: { status: AgentTask['status']; errorMessage?: string | null }
): Promise<void> {
  const db = createServerClient();
  const updateData: Record<string, unknown> = {
    status: updates.status,
  };
  if (updates.errorMessage !== undefined) {
    updateData.error_message = updates.errorMessage;
  }
  if (updates.status === 'completed' || updates.status === 'failed') {
    updateData.completed_at = new Date().toISOString();
  }

  await db
    .from('agent_tasks')
    .update(updateData)
    .eq('id', taskId)
    .eq('org_id', orgId);
}

/**
 * Update task result (output, status, tokens, cost)
 */
export async function updateTaskResult(
  taskId: string,
  orgId: string,
  result: {
    status: AgentTask['status'];
    output: string;
    tokensUsed?: number;
    costUsd?: number;
    errorMessage?: string | null;
  }
): Promise<void> {
  const db = createServerClient();
  const updateData: Record<string, unknown> = {
    status: result.status,
    output: result.output,
    completed_at: new Date().toISOString(),
  };
  if (result.tokensUsed !== undefined) updateData.tokens_used = result.tokensUsed;
  if (result.costUsd !== undefined) updateData.cost_usd = result.costUsd;
  if (result.errorMessage !== undefined) updateData.error_message = result.errorMessage;

  await db
    .from('agent_tasks')
    .update(updateData)
    .eq('id', taskId)
    .eq('org_id', orgId);
}
