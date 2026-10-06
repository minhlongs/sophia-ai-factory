/**
 * Agent Governance YAML (AGY) Zod Validation Schema
 *
 * Seed Layer: Pure declarative Zod validation schemas for AGY specifications.
 * Enforces strict validation of schema versions, agent identity, L0-L4 autonomy bounds,
 * compute limits (positive integers), permission lists, and escalation policies.
 *
 * @module seed/validators/agy-schema
 */

import { z } from 'zod';
import type {
  AgentGovernanceYaml,
} from '@/seed/types/agent-governance';

/**
 * Valid autonomy levels: L0 to L4.
 */
export const autonomyLevelSchema = z.enum(['L0', 'L1', 'L2', 'L3', 'L4'], {
  message: 'agent.maxAutonomyLevel must be one of L0, L1, L2, L3, L4',
});

/**
 * Agent identity and maximum autonomy spec.
 */
export const agentSpecSchema = z.object({
  id: z.string().trim().min(1, 'agent.id is required'),
  name: z.string().trim().min(1, 'agent.name is required'),
  role: z.string().trim().min(1, 'agent.role is required'),
  maxAutonomyLevel: autonomyLevelSchema,
});

/**
 * Compute limits: positive integers for tokens and compute units.
 */
export const computeLimitsSchema = z.object({
  maxTokensPerRun: z
    .number()
    .int('compute.maxTokensPerRun must be an integer')
    .positive('compute.maxTokensPerRun must be a positive integer'),
  maxComputeUnitsMcu: z
    .number()
    .int('compute.maxComputeUnitsMcu must be an integer')
    .positive('compute.maxComputeUnitsMcu must be a positive integer'),
});

/**
 * Permission rule arrays.
 */
export const permissionRulesSchema = z.object({
  allow: z.array(z.string().trim()).default([]),
  deny: z.array(z.string().trim()).default([]),
});

/**
 * Escalation policy.
 */
export const escalationPolicySchema = z.object({
  onQuotaExceeded: z.enum(['halt', 'request_approval'], {
    message: 'escalation.onQuotaExceeded must be halt or request_approval',
  }),
  onDisallowedAction: z.enum(['halt', 'escalate_human'], {
    message: 'escalation.onDisallowedAction must be halt or escalate_human',
  }),
});

/**
 * Complete AGY Document schema.
 */
export const agentGovernanceYamlSchema = z.object({
  schemaVersion: z.string().trim().min(1, 'schemaVersion is required'),
  agent: agentSpecSchema,
  compute: computeLimitsSchema,
  permissions: permissionRulesSchema,
  escalation: escalationPolicySchema,
});

/**
 * Validates unknown data against the AGY schema.
 * Throws a formatted Error with clear messages if validation fails.
 */
export function validateAgySchema(data: unknown): AgentGovernanceYaml {
  const result = agentGovernanceYamlSchema.safeParse(data);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((e) => `${e.path.join('.') || 'root'}: ${e.message}`)
      .join('; ');
    throw new Error(`INVALID_SCHEMA: ${errorDetails}`);
  }
  return result.data as AgentGovernanceYaml;
}
