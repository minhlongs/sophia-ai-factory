'use server';
/**
 * Server Action: configureAgentTeam
 * CRUD operations for agent team configuration.
 *
 * Flow: auth → seed team → mutate agents → return updated team
 */
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { seedDefaultTeam } from '@/tree/agents/seed-default-team';
import {
  createAgent,
  updateAgent,
  deleteAgent,
  getAgentById,
  listAgents,
  getTeamByOrgId,
} from '@/tree/agents/repository';
import type { Agent } from '@/tree/agents/types';

// ── Schemas ──────────────────────────────────────────────────────────────────

const AgentRoleSchema = z.enum(['CEO', 'Developer', 'QA', 'Ops', 'Marketing']);

const CreateAgentSchema = z.object({
  role: AgentRoleSchema,
  name: z.string().min(1).max(100),
  systemPrompt: z.string().min(10).max(4000),
  model: z.string().optional(),
});

const UpdateAgentSchema = z.object({
  agentId: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  systemPrompt: z.string().min(10).max(4000).optional(),
  model: z.string().optional(),
  enabled: z.boolean().optional(),
});

const DeleteAgentSchema = z.object({
  agentId: z.string().min(1),
});

// ── Types ────────────────────────────────────────────────────────────────────

export type CreateAgentInput = z.infer<typeof CreateAgentSchema>;
export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>;
export type DeleteAgentInput = z.infer<typeof DeleteAgentSchema>;

export interface AgentTeamConfigResult {
  success: boolean;
  team?: { id: string; name: string; agents: Agent[] };
  error?: string;
}

// ── Actions ──────────────────────────────────────────────────────────────────

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
    const agent = await createAgent({
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

// ── Bulk Operations ───────────────────────────────────────────────────────────

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
