import { createServerClient } from '@/seed/db/client';
import type { Agent, AgentRow } from '../types';
import { mapAgent } from './mappers';

export const MAX_SYSTEM_PROMPT_CHARS = 8_000;

export async function listAgents(teamId: string): Promise<Agent[]> {
  const db = createServerClient();
  const { data, error } = await db
    .from('agents')
    .select('*')
    .eq('team_id', teamId)
    .eq('enabled', 1);
  if (error || !data) return [];
  return (data as unknown as AgentRow[]).map(mapAgent);
}

export async function createAgent(params: {
  teamId: string;
  role: 'CEO' | 'CTO' | 'CSO' | 'CMO' | 'COO' | 'Developer' | 'QA' | 'Ops' | 'Marketing';
  name: string;
  systemPrompt: string;
  model?: string;
}): Promise<Agent> {
  if (params.systemPrompt.length > MAX_SYSTEM_PROMPT_CHARS) {
    throw new Error(
      `createAgent failed: systemPrompt exceeds ${MAX_SYSTEM_PROMPT_CHARS} chars (got ${params.systemPrompt.length})`,
    );
  }
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
  return mapAgent(data as unknown as AgentRow);
}

export async function getAgentById(agentId: string): Promise<Agent | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .maybeSingle();
  if (error || !data) return null;
  return mapAgent(data as unknown as AgentRow);
}

export async function updateAgent(
  agentId: string,
  params: {
    name?: string;
    systemPrompt?: string;
    model?: string;
    enabled?: boolean;
  },
): Promise<void> {
  const db = createServerClient();
  const update: Record<string, unknown> = {};
  if (params.name !== undefined) update.name = params.name;
  if (params.systemPrompt !== undefined)
    update.system_prompt = params.systemPrompt;
  if (params.model !== undefined) update.model = params.model;
  if (params.enabled !== undefined) update.enabled = params.enabled ? 1 : 0;
  const { error } = await db.from('agents').update(update).eq('id', agentId);
  if (error) throw new Error(`updateAgent failed: ${String(error)}`);
}

export async function deleteAgent(agentId: string): Promise<void> {
  const db = createServerClient();
  const { error } = await db.from('agents').delete().eq('id', agentId);
  if (error) throw new Error(`deleteAgent failed: ${String(error)}`);
}
