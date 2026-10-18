/**
 * Section validators for Agent Governance YAML (AGY) documents.
 *
 * Layer: seed/validators
 */

import type {
  AutonomyLevel,
  AgentGovernanceYaml,
} from '@/seed/types/agent-governance';

const VALID_AUTONOMIES: readonly AutonomyLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4'];

export function validateAgentSection(
  raw: unknown,
): AgentGovernanceYaml['agent'] {
  const agent = raw as Record<string, unknown> | undefined;
  if (!agent || typeof agent !== 'object' || Array.isArray(agent)) {
    throw new Error('INVALID_SCHEMA: agent section is required');
  }
  if (typeof agent.id !== 'string' || !agent.id.trim()) {
    throw new Error('INVALID_SCHEMA: agent.id is required');
  }
  if (typeof agent.name !== 'string' || !agent.name.trim()) {
    throw new Error('INVALID_SCHEMA: agent.name is required');
  }
  if (typeof agent.role !== 'string' || !agent.role.trim()) {
    throw new Error('INVALID_SCHEMA: agent.role is required');
  }
  const maxAutonomy = agent.maxAutonomyLevel as string;
  if (!VALID_AUTONOMIES.includes(maxAutonomy as AutonomyLevel)) {
    throw new Error(
      `INVALID_SCHEMA: agent.maxAutonomyLevel must be one of L0, L1, L2, L3, L4 (received ${maxAutonomy})`,
    );
  }
  return {
    id: agent.id.trim(),
    name: agent.name.trim(),
    role: agent.role.trim(),
    maxAutonomyLevel: maxAutonomy as AutonomyLevel,
  };
}

export function validateComputeSection(
  raw: unknown,
): AgentGovernanceYaml['compute'] {
  const compute = raw as Record<string, unknown> | undefined;
  if (!compute || typeof compute !== 'object' || Array.isArray(compute)) {
    throw new Error('INVALID_SCHEMA: compute section is required');
  }
  if (
    typeof compute.maxTokensPerRun !== 'number' ||
    compute.maxTokensPerRun <= 0 ||
    !Number.isFinite(compute.maxTokensPerRun)
  ) {
    throw new Error('INVALID_SCHEMA: compute.maxTokensPerRun must be a positive integer');
  }
  if (
    typeof compute.maxComputeUnitsMcu !== 'number' ||
    compute.maxComputeUnitsMcu <= 0 ||
    !Number.isFinite(compute.maxComputeUnitsMcu)
  ) {
    throw new Error('INVALID_SCHEMA: compute.maxComputeUnitsMcu must be a positive integer');
  }
  return {
    maxTokensPerRun: Math.floor(compute.maxTokensPerRun),
    maxComputeUnitsMcu: Math.floor(compute.maxComputeUnitsMcu),
  };
}

export function validatePermissionsSection(
  raw: unknown,
): AgentGovernanceYaml['permissions'] {
  const permissions = raw as Record<string, unknown> | undefined;
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
    throw new Error('INVALID_SCHEMA: permissions section is required');
  }
  if (!Array.isArray(permissions.allow)) {
    throw new Error('INVALID_SCHEMA: permissions.allow must be an array');
  }
  if (!Array.isArray(permissions.deny)) {
    throw new Error('INVALID_SCHEMA: permissions.deny must be an array');
  }
  return {
    allow: permissions.allow.map((p) => String(p).trim()).filter(Boolean),
    deny: permissions.deny.map((p) => String(p).trim()).filter(Boolean),
  };
}

export function validateEscalationSection(
  raw: unknown,
): AgentGovernanceYaml['escalation'] {
  const escalation = raw as Record<string, unknown> | undefined;
  if (!escalation || typeof escalation !== 'object' || Array.isArray(escalation)) {
    throw new Error('INVALID_SCHEMA: escalation section is required');
  }
  if (!['halt', 'request_approval'].includes(escalation.onQuotaExceeded as string)) {
    throw new Error('INVALID_SCHEMA: escalation.onQuotaExceeded must be halt or request_approval');
  }
  if (!['halt', 'escalate_human'].includes(escalation.onDisallowedAction as string)) {
    throw new Error('INVALID_SCHEMA: escalation.onDisallowedAction must be halt or escalate_human');
  }
  return {
    onQuotaExceeded: escalation.onQuotaExceeded as 'halt' | 'request_approval',
    onDisallowedAction: escalation.onDisallowedAction as 'halt' | 'escalate_human',
  };
}
