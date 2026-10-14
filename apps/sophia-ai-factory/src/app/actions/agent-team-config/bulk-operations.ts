'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { seedDefaultTeam } from '@/tree/agents/seed-default-team';
import { createAgent, listAgents } from '@/tree/agents/repository';
import {
  CreateAgentSchema,
  type CreateAgentInput,
  type AgentTeamConfigResult,
} from './schemas';

/**
 * Create multiple agents in parallel.
 * Validates all inputs first, then creates concurrently.
 */
export async function createAgentsInTeam(
  inputs: CreateAgentInput[]
): Promise<AgentTeamConfigResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    if (!inputs.length) {
      return { success: false, error: 'No agents provided' };
    }

    // Validate all inputs upfront
    const parsedResults = inputs.map(input => CreateAgentSchema.safeParse(input));
    const firstError = parsedResults.find(r => !r.success);
    if (firstError) {
      return { success: false, error: firstError.error.issues[0]?.message ?? 'Invalid input' };
    }

    // Extract valid inputs
    const validInputs: CreateAgentInput[] = [];
    for (const r of parsedResults) {
      if (r.success) {
        validInputs.push(r.data);
      }
    }

    const team = await seedDefaultTeam(user.id);

    // Create all agents in parallel
    await Promise.all(
      validInputs.map(input =>
        createAgent({
          teamId: team.id,
          role: input.role,
          name: input.name,
          systemPrompt: input.systemPrompt,
          model: input.model,
        })
      )
    );

    const agents = await listAgents(team.id);
    return { success: true, team: { id: team.id, name: team.name, agents } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create agents';
    return { success: false, error: message };
  }
}
