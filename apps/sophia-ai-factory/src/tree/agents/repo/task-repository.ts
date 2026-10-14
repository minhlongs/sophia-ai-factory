import { createServerClient } from '@/seed/db/client';
import type {
  AgentTask,
  AgentLog,
  AgentTaskRow,
  AgentLogRow,
  AgentTaskStatus,
} from '../types';
import { mapTask, mapLog } from './mappers';

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
  return mapTask(data as unknown as AgentTaskRow);
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
  return mapTask(data as unknown as AgentTaskRow);
}

export async function updateTaskStatus(
  taskId: string,
  orgId: string,
  status: AgentTaskStatus,
): Promise<void> {
  const db = createServerClient();
  await db.from('agent_tasks').update({ status }).eq('id', taskId).eq('org_id', orgId);
}

export async function updateTaskResult(taskId: string, orgId: string, params: {
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
  }).eq('id', taskId).eq('org_id', orgId);
}

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
  return mapLog(data as unknown as AgentLogRow);
}
