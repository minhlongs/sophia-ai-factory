'use server';

/**
 * Autonomous FSM Lifecycle Mutations
 * Land Layer - Start, Pause, Resume, Emergency Halt, Reset Circuit Breaker
 *
 * @module land/autonomous/loop-actions-lifecycle
 */

import type {
  AutonomousActionResult,
  StateTransitionResult,
} from '@/seed/types/autonomous-engine';
import { performLifecycleTransition } from './loop-lifecycle-transition';

/**
 * Action: Start the autonomous execution loop (IDLE -> RUNNING).
 */
export async function startAutonomousLoopAction(
  tenantId: string = 'default',
  dbOverride?: unknown,
): Promise<AutonomousActionResult<StateTransitionResult>> {
  return performLifecycleTransition(
    tenantId,
    'START',
    { updateHeartbeat: true },
    dbOverride,
  );
}

/**
 * Action: Pause the autonomous execution loop.
 */
export async function pauseAutonomousLoopAction(
  reason: string = 'Manual operator pause',
  tenantId: string = 'default',
  dbOverride?: unknown,
): Promise<AutonomousActionResult<StateTransitionResult>> {
  return performLifecycleTransition(
    tenantId,
    'PAUSE_CMD',
    { pauseReason: reason },
    dbOverride,
  );
}

/**
 * Action: Resume the autonomous execution loop from PAUSED to IDLE.
 */
export async function resumeAutonomousLoopAction(
  tenantId: string = 'default',
  dbOverride?: unknown,
): Promise<AutonomousActionResult<StateTransitionResult>> {
  return performLifecycleTransition(
    tenantId,
    'RESUME_CMD',
    { updateHeartbeat: true },
    dbOverride,
  );
}

/**
 * Action: Emergency Halt — immediate suspension to PAUSED from any state.
 */
export async function emergencyHaltAutonomousLoopAction(
  reason: string = 'Emergency stop triggered by operator',
  tenantId: string = 'default',
  dbOverride?: unknown,
): Promise<AutonomousActionResult<StateTransitionResult>> {
  return performLifecycleTransition(
    tenantId,
    'EMERGENCY_HALT',
    { pauseReason: reason, lastError: reason },
    dbOverride,
  );
}

/**
 * Action: Reset Circuit Breaker (CIRCUIT_BROKEN -> IDLE).
 */
export async function resetAutonomousCircuitBreakerAction(
  tenantId: string = 'default',
  dbOverride?: unknown,
): Promise<AutonomousActionResult<StateTransitionResult>> {
  return performLifecycleTransition(
    tenantId,
    'MANUAL_RESET',
    { resetFailures: true, lastError: null },
    dbOverride,
  );
}

export const resetCircuitBreakerAction = resetAutonomousCircuitBreakerAction;
