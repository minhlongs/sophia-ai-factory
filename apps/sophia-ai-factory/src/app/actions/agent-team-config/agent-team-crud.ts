'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { seedDefaultTeam } from '@/tree/agents/seed-default-team';
import {
  createAgent,
  updateAgent,
  deleteAgent,
  getAgentById,
  listAgents,
} from '@/tree/agents/repository';
import {
  CreateAgentSchema,
  UpdateAgentSchema,
  DeleteAgentSchema,
  type CreateAgentInput,
  type UpdateAgentInput,
  type DeleteAgentInput,
  type AgentTeamConfigResult,
} from './schemas';

export async function createAgentInTeam(
  input: CreateAgentInput,
): Promise<AgentTeamConfigResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const parsed = CreateAgentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const team = await seedDefaultTeam(user.id);
    await createAgent({
      teamId: team.id,
      role: parsed.data.role,
      name: parsed.data.name,
      systemPrompt: parsed.data.systemPrompt,
      model: parsed.data.model,
    });

    const agents = await listAgents(team.id);
    return { success: true, team: { id: team.id, name: team.name, agents } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create agent';
    return { success: false, error: message };
  }
}

export async function updateAgentInTeam(
  input: UpdateAgentInput,
): Promise<AgentTeamConfigResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const parsed = UpdateAgentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const team = await seedDefaultTeam(user.id);
    const existing = await getAgentById(parsed.data.agentId);
    if (!existing || existing.teamId !== team.id) {
      return { success: false, error: 'Agent not found in your team' };
    }

    await updateAgent(parsed.data.agentId, {
      name: parsed.data.name,
      systemPrompt: parsed.data.systemPrompt,
      model: parsed.data.model,
      enabled: parsed.data.enabled,
    });

    const agents = await listAgents(team.id);
    return { success: true, team: { id: team.id, name: team.name, agents } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update agent';
    return { success: false, error: message };
  }
}

export async function removeAgentFromTeam(
  input: DeleteAgentInput,
): Promise<AgentTeamConfigResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    const parsed = DeleteAgentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }

    const team = await seedDefaultTeam(user.id);
    const existing = await getAgentById(parsed.data.agentId);
    if (!existing || existing.teamId !== team.id) {
      return { success: false, error: 'Agent not found in your team' };
    }

    // Prevent deleting the last agent
    const currentAgents = await listAgents(team.id);
    if (currentAgents.length <= 1) {
      return { success: false, error: 'Cannot remove the last agent from team' };
    }

    await deleteAgent(parsed.data.agentId);
    const agents = await listAgents(team.id);
    return { success: true, team: { id: team.id, name: team.name, agents } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to remove agent';
    return { success: false, error: message };
  }
}

export async function getAgentTeam() {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: 'Unauthorized', team: null };

    const team = await seedDefaultTeam(user.id);
    const agents = await listAgents(team.id);
    return { success: true, team: { id: team.id, name: team.name, agents } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load team';
    return { success: false, error: message, team: null };
  }
}
