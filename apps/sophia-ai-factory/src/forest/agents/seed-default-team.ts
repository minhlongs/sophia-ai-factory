/**
 * Agent Factory — Seed default CEO + Developer agents for an org.
 * Idempotent: safe to call multiple times.
 */

import { getOrCreateTeam, listAgents, createAgent } from './repository';
import {
  CEO_PROMPT,
  CTO_PROMPT,
  CSO_PROMPT,
  CMO_PROMPT,
  COO_PROMPT,
  QA_PROMPT,
  OPS_PROMPT,
  MARKETING_PROMPT,
} from './prompts';
import type { AgentTeam } from './types';

const DEFAULT_AGENTS = [
  { role: 'CEO' as const, name: 'CEO Agent', prompt: CEO_PROMPT },
  { role: 'CTO' as const, name: 'CTO Agent', prompt: CTO_PROMPT },
  { role: 'CSO' as const, name: 'CSO Agent', prompt: CSO_PROMPT },
  { role: 'CMO' as const, name: 'CMO Agent', prompt: CMO_PROMPT },
  { role: 'COO' as const, name: 'COO Agent', prompt: COO_PROMPT },
  { role: 'QA' as const, name: 'QA Agent', prompt: QA_PROMPT },
  { role: 'Ops' as const, name: 'Ops Agent', prompt: OPS_PROMPT },
  { role: 'Marketing' as const, name: 'Marketing Agent', prompt: MARKETING_PROMPT },
];

/**
 * Ensure org has an agent_team with all default agents.
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
