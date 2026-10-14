/**
 * Agent Repository Agent Queries
 * Layer: forest
 *
 * @module forest/agents/repository/agent-queries
 */

import { createServerClient } from '@/seed/db/client';
import type {
  AgentTeam,
  Agent,
  AgentTeamRow,
  AgentRow,
} from '../types';
import { mapAgentTeam, mapAgent } from './mappers';

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
