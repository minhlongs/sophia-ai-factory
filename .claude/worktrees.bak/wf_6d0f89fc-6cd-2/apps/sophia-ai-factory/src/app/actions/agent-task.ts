'use server';

/**
 * Server Action: createAgentTask
 * Auth → seed team → create task → run agent inline → return task
 */

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { seedDefaultTeam } from '@/tree/agents/seed-default-team';
import { createTask, listAgents, getTask } from '@/tree/agents/repository';
import { runAgent } from '@/tree/agents/runner';
import type { AgentTask } from '@/tree/agents/types';

const CreateAgentTaskSchema = z.object({
  agentId: z.string().min(1).optional(),
  input: z.string().min(1).max(4000),
  role: z.enum(['CEO', 'Developer']).optional(),
});

export type CreateAgentTaskInput = z.infer<typeof CreateAgentTaskSchema>;

export interface CreateAgentTaskResult {
  success: boolean;
  task?: AgentTask;
  error?: string;
}

export async function createAgentTask(
  input: CreateAgentTaskInput,
): Promise<CreateAgentTaskResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsed = CreateAgentTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }

  const { agentId, input: taskInput, role } = parsed.data;
  const orgId = user.id; // user.id used as org_id (existing pattern)

  try {
    // Ensure team + default agents exist
    const team = await seedDefaultTeam(orgId);

    // Resolve which agent to use
    let resolvedAgentId = agentId;
    if (!resolvedAgentId) {
      const agents = await listAgents(team.id);
      const targetRole = role ?? 'CEO';
      const agent = agents.find((a) => a.role === targetRole) ?? agents[0];
      if (!agent) {
        return { success: false, error: 'No agents available. Please try again.' };
      }
      resolvedAgentId = agent.id;
    }

    // Create task
    const task = await createTask({ orgId, agentId: resolvedAgentId, input: taskInput });

    // Resolve real user tier (B1 fix: previously defaulted to BASIC, blocking all paid users)
    const userTier = await resolveUserTier(user.id);

    // Run inline (Cloudflare Workers free tier — no background jobs)
    await runAgent(task.id, orgId, userTier);

    // Return completed task
    const completed = await getTask(task.id, orgId);
    return { success: true, task: completed ?? task };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { success: false, error: message };
  }
}
