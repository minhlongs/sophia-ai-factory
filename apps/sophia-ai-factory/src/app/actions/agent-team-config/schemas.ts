import { z } from 'zod';
import type { Agent } from '@/tree/agents/types';

// ── Schemas ──────────────────────────────────────────────────────────────────

export const AgentRoleSchema = z.enum(['CEO', 'Developer', 'QA', 'Ops', 'Marketing']);

export const CreateAgentSchema = z.object({
  role: AgentRoleSchema,
  name: z.string().min(1).max(100),
  systemPrompt: z.string().min(10).max(4000),
  model: z.string().optional(),
});

export const UpdateAgentSchema = z.object({
  agentId: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  systemPrompt: z.string().min(10).max(4000).optional(),
  model: z.string().optional(),
  enabled: z.boolean().optional(),
});

export const DeleteAgentSchema = z.object({
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
