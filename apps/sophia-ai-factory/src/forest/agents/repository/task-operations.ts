/**
 * Agent Repository Task Operations
 * Layer: forest
 *
 * @module forest/agents/repository/task-operations
 */

import { createServerClient } from '@/seed/db/client';
import type {
  AgentTask,
  AgentLog,
  AgentTaskRow,
  AgentLogRow,
} from '../types';
import { mapTask, mapLog } from './mappers';

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
  updates: { status: AgentTask['status']; errorMessage?: string | null },
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
  },
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
