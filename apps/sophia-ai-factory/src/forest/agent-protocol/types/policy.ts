/**
 * Agent Policy Enforcement & Permissions Helpers
 * Layer: forest/agent-protocol/types
 */

import type {
  AgentAction,
  AgentDefinition,
  AgentPermission,
  AutonomyLevel,
} from '@/seed/types/creative-domain';

export function checkAgentPermission(
  agent: AgentDefinition,
  action: AgentAction,
  autonomyLevel: AutonomyLevel,
): { allowed: boolean; reason?: string } {
  const perm = agent.permissions.find((p) => p.tool === action.tool || p.tool === '*');
  if (!perm) return { allowed: false, reason: `Tool ${action.tool} not permitted for ${agent.name}` };

  if (autonomyLevel < 2 && perm.requiresApproval) {
    return { allowed: false, reason: `Requires human approval (autonomy level ${autonomyLevel})` };
  }

  if (perm.maxCostCents !== undefined && (action.estimatedCostCents ?? 0) > perm.maxCostCents) {
    return { allowed: false, reason: `Cost exceeds limit: ${action.estimatedCostCents} > ${perm.maxCostCents} cents` };
  }

  return { allowed: true };
}

export function requiresApproval(action: AgentAction, autonomyLevel: AutonomyLevel): boolean {
  return autonomyLevel < 2 || action.approvalRequired;
}

export function defaultAgentPermissions(tools: string[]): AgentPermission[] {
  return tools.map((tool) => ({
    tool,
    scopes: [tool],
    requiresApproval: true,
    maxCostCents: 1000,
  }));
}
