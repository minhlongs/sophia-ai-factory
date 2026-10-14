import { createServerClient } from '@/seed/db/client';
import type { AgentTeam, AgentTeamRow } from '../types';
import { mapTeam } from './mappers';

export async function getTeamByOrgId(orgId: string): Promise<AgentTeam | null> {
  const db = createServerClient();
  const { data, error } = await db
    .from('agent_teams')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();
  if (error || !data) return null;
  return mapTeam(data as unknown as AgentTeamRow);
}

export async function createTeam(orgId: string, name = 'My AI Company'): Promise<AgentTeam> {
  const db = createServerClient();
  const { data, error } = await db
    .from('agent_teams')
    .insert({ org_id: orgId, name, config: '{}' })
    .select()
    .single();
  if (error || !data) throw new Error(`createTeam failed: ${String(error)}`);
  return mapTeam(data as unknown as AgentTeamRow);
}

export async function getOrCreateTeam(orgId: string): Promise<AgentTeam> {
  const existing = await getTeamByOrgId(orgId);
  if (existing) return existing;
  return createTeam(orgId);
}
