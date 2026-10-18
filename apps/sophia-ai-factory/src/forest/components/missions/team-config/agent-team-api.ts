'use client';

import type { Agent } from '@/forest/agents/types';
import type { AgentFormState, DialogMode } from './types';

export interface AgentTeamApiResponse {
  success: boolean;
  team?: { agents: Agent[] };
  error?: string;
}

export async function fetchAgentTeamRequest(): Promise<AgentTeamApiResponse> {
  const res = await fetch('/api/agents/team');
  return (await res.json()) as AgentTeamApiResponse;
}

export async function submitAgentTeamFormRequest(
  mode: DialogMode,
  form: AgentFormState,
  editingAgentId?: string,
): Promise<AgentTeamApiResponse> {
  const endpoint =
    mode === 'create' ? '/api/agents/team/create' : '/api/agents/team/update';
  const body =
    mode === 'create' ? form : { agentId: editingAgentId, ...form };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await res.json()) as AgentTeamApiResponse;
}

export async function toggleAgentTeamMemberRequest(
  agentId: string,
  enabled: boolean,
): Promise<AgentTeamApiResponse> {
  const res = await fetch('/api/agents/team/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, enabled }),
  });
  return (await res.json()) as AgentTeamApiResponse;
}

export async function deleteAgentTeamMemberRequest(
  agentId: string,
): Promise<AgentTeamApiResponse> {
  const res = await fetch('/api/agents/team/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId }),
  });
  return (await res.json()) as AgentTeamApiResponse;
}
