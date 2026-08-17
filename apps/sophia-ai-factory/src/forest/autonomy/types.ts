/**
 * Autonomy Level Enforcement
 * Layer: forest (reusable infrastructure)
 *
 * Centralized autonomy enforcement for Sophia 2027 agents.
 * Each agent operates at a specific autonomy level (0-4) that determines
 * what actions it can execute without requiring human approval.
 *
 * Autonomy Levels:
 *   0 = OBSERVE_ONLY   — Read-only, no side effects permitted
 *   1 = SUGGEST        — Can suggest actions but not execute them
 *   2 = EXECUTE_SAFE   — Execute pre-approved safe actions only
 *   3 = EXECUTE_BROAD  — Execute most actions, human-gate on expensive ones
 *   4 = FULL_AUTONOMY  — Execute everything without human approval
 *
 * @module forest/autonomy
 */

import type {
  AutonomyLevel,
  AgentAction,
  AgentDefinition,
} from '@/seed/types/creative-domain';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class AutonomyError extends Error {
  constructor(
    code: AutonomyErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AutonomyError';
    this.code = code;
  }

  readonly code: AutonomyErrorCode;
}

export type AutonomyErrorCode =
  | 'LEVEL_INSUFFICIENT'
  | 'APPROVAL_REQUIRED'
  | 'COST_EXCEEDS_LIMIT'
  | 'TOOL_NOT_PERMITTED'
  | 'INVALID_LEVEL'
  | 'AGENT_NOT_FOUND';

// ---------------------------------------------------------------------------
// Autonomy level descriptors
// ---------------------------------------------------------------------------

export interface AutonomyLevelDescriptor {
  level: AutonomyLevel;
  name: string;
  description: string;
  /** Cost (cents) at or below which no human approval is needed. Infinity = no limit. */
  autoApproveCostCents: number;
  /** Whether this level can execute side-effecting actions at all. */
  canExecute: boolean;
}

export const AUTONOMY_LEVELS: readonly AutonomyLevelDescriptor[] = [
  {
    level: 0,
    name: 'OBSERVE_ONLY',
    description: 'Read-only. No side effects permitted.',
    autoApproveCostCents: 0,
    canExecute: false,
  },
  {
    level: 1,
    name: 'SUGGEST',
    description: 'Can suggest actions but not execute them. Human must approve all.',
    autoApproveCostCents: 0,
    canExecute: false,
  },
  {
    level: 2,
    name: 'EXECUTE_SAFE',
    description: 'Execute pre-approved safe actions. Human gates on expensive or risky ones.',
    autoApproveCostCents: 500,
    canExecute: true,
  },
  {
    level: 3,
    name: 'EXECUTE_BROAD',
    description: 'Execute most actions. Human gates only on high-cost or irreversible ones.',
    autoApproveCostCents: 2_000,
    canExecute: true,
  },
  {
    level: 4,
    name: 'FULL_AUTONOMY',
    description: 'Full execution authority. No human approval required.',
    autoApproveCostCents: Infinity,
    canExecute: true,
  },
] as const;

/**
 * Get the descriptor for a given autonomy level.
 * Throws AutonomyError if level is not 0-4.
 */
export function getAutonomyLevelDescriptor(level: AutonomyLevel): AutonomyLevelDescriptor {
  const descriptor = AUTONOMY_LEVELS.find((d) => d.level === level);
  if (!descriptor) {
    throw new AutonomyError('INVALID_LEVEL', `Invalid autonomy level: ${level}`);
  }
  return descriptor;
}

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
