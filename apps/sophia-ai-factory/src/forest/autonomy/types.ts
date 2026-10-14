/**
 * Autonomy Level Enforcement
 * Layer: forest (reusable infrastructure)
 *
 * Centralized autonomy enforcement for Sophia 2027 agents.
 * Each agent operates at a specific autonomy level (0-4) that determines
 * what actions it can execute without requiring human approval.
 *
 * @module forest/autonomy
 */

import type {
  AutonomyLevel,
  AgentAction,
  AgentDefinition,
} from '@/seed/types/creative-domain';
import { getAutonomyLevelDescriptor } from './autonomy-levels';

export { AutonomyError } from './autonomy-error';
export type { AutonomyErrorCode } from './autonomy-error';
export { AUTONOMY_LEVELS, getAutonomyLevelDescriptor } from './autonomy-levels';
export type { AutonomyLevelDescriptor } from './autonomy-levels';

// ---------------------------------------------------------------------------
// Core enforcement functions
// ---------------------------------------------------------------------------

/**
 * Determines whether an action requires human approval at the given autonomy level.
 * Returns true when: action marks approvalRequired, level < EXECUTE_SAFE, or cost exceeds threshold.
 */
export function requiresApproval(
  action: AgentAction,
  autonomyLevel: AutonomyLevel,
): boolean {
  if (action.approvalRequired) return true;

  const descriptor = getAutonomyLevelDescriptor(autonomyLevel);
  if (!descriptor.canExecute) return true;

  const cost = action.estimatedCostCents ?? 0;
  if (cost > descriptor.autoApproveCostCents) return true;

  return false;
}

/**
 * Checks whether an agent has permission to perform an action at its autonomy level.
 * Validates tool permission, autonomy level sufficiency, and cost limits.
 */
export function checkPermission(
  agent: AgentDefinition,
  action: AgentAction,
  autonomyLevel: AutonomyLevel,
): { allowed: boolean; reason?: string } {
  const perm = agent.permissions.find(
    (p) => p.tool === action.tool || p.tool === '*',
  );

  if (!perm) {
    return {
      allowed: false,
      reason: `Tool '${action.tool}' not permitted for agent '${agent.name}'`,
    };
  }

  const descriptor = getAutonomyLevelDescriptor(autonomyLevel);

  if (!descriptor.canExecute && !action.approvalRequired) {
    return {
      allowed: false,
      reason: `Autonomy level ${autonomyLevel} (${descriptor.name}) cannot execute actions directly`,
    };
  }

  if (perm.maxCostCents !== undefined) {
    const actionCost = action.estimatedCostCents ?? 0;
    if (actionCost > perm.maxCostCents) {
      return {
        allowed: false,
        reason: `Action cost ${actionCost} cents exceeds permission limit of ${perm.maxCostCents} cents`,
      };
    }
  }

  if (requiresApproval(action, autonomyLevel)) {
    return {
      allowed: false,
      reason: `Human approval required at autonomy level ${autonomyLevel}`,
    };
  }

  return { allowed: true };
}
