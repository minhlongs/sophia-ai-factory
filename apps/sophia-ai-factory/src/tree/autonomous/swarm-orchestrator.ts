/**
 * Autonomous Swarm Orchestrator & Governance Enforcer
 * Tree Layer - Deterministic domain logic for autonomous swarm capability dispatch,
 * AGY policy integration, and execution gating.
 *
 * @module tree/autonomous/swarm-orchestrator
 */

import type {
  AutonomousCapability,
  AutonomousScheduleTaskRow,
} from '@/seed/types/autonomous-engine';
import {
  CAPABILITY_BUDGETS,
  type SwarmExecutionContext,
  type SwarmExecutionResult,
} from './swarm-types';
import { canExecuteCapability } from './swarm-capability-gate';
import { dispatchAllowedCapability } from './swarm-capability-handlers';

export { canExecuteCapability };
export * from './swarm-types';
export * from './swarm-affiliate-scout';
export * from './swarm-content-producer';
export * from './swarm-auto-publisher';
export * from './swarm-telemetry';

/**
 * Executes an autonomous swarm task with genuine capability handler logic,
 * AGY policy enforcement, and audit telemetry generation.
 */
export function executeSwarmTask(
  task: AutonomousScheduleTaskRow,
  context: SwarmExecutionContext,
): SwarmExecutionResult {
  const cap = (task.capability_name || task.skill_name) as AutonomousCapability;
  const budget = CAPABILITY_BUDGETS[cap];

  if (!budget) {
    return {
      success: false,
      capability: cap,
      mcuConsumed: 0,
      tokensUsed: 0,
      actionsTaken: [],
      error: `Unknown capability: ${cap}`,
    };
  }

  const budgetCheck = canExecuteCapability(cap, context);
  if (!budgetCheck.allowed) {
    return {
      success: false,
      capability: cap,
      mcuConsumed: 0,
      tokensUsed: 0,
      actionsTaken: [],
      error: budgetCheck.reason,
      governanceVerdict: budgetCheck.verdict,
      escalationTriggered: budgetCheck.verdict?.escalationTriggered,
    };
  }

  return dispatchAllowedCapability(cap, budget, context, budgetCheck.verdict);
}
