/**
 * Agent Factory — Seed default CEO + Developer agents for an org.
 * Idempotent: safe to call multiple times.
 */

import { getOrCreateTeam, listAgents, createAgent } from './repository';
import { CEO_PROMPT, DEVELOPER_PROMPT } from './prompts';
import type { AgentTeam } from './types';

const DEFAULT_AGENTS = [
  { role: 'CEO' as const, name: 'CEO Agent', prompt: CEO_PROMPT },
  { role: 'Developer' as const, name: 'Developer Agent', prompt: DEVELOPER_PROMPT },
];

/**
 * Ensure org has an agent_team with CEO + Developer agents.
 * Returns the team (existing or newly created).
 */
export async function seedDefaultTeam(orgId: string): Promise<AgentTeam> {
  const team = await getOrCreateTeam(orgId);
  const existingAgents = await listAgents(team.id);
  const existingRoles = new Set(existingAgents.map((a) => a.role));

  const creates = DEFAULT_AGENTS.filter((def) => !existingRoles.has(def.role));
  for (const def of creates) {
    await createAgent({
      teamId: team.id,
      role: def.role,
      name: def.name,
      systemPrompt: def.prompt,
    });
  }

  return team;
}
