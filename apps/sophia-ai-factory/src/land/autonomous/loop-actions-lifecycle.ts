'use server';

/**
 * Autonomous FSM Lifecycle Mutations
 * Land Layer - Start, Pause, Resume, Emergency Halt, Reset Circuit Breaker
 *
 * @module land/autonomous/loop-actions-lifecycle
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  AutonomousActionResult,
  StateTransitionResult,
  AutonomousEngineState,
  AutonomousStateEvent,
} from '@/seed/types/autonomous-engine';
import { transitionAutonomousState } from '@/tree/autonomous/state-machine';
import { resolveDb, ensureTenantLoopState } from './loop-actions-db';

interface LifecycleOpts {
  pauseReason?: string;
  resetFailures?: boolean;
  updateHeartbeat?: boolean;
  lastError?: string | null;
}

async function performLifecycleTransition(
  tenantId: string,
  event: AutonomousStateEvent,
  opts: LifecycleOpts = {},
  dbOverride?: unknown,
): Promise<AutonomousActionResult<StateTransitionResult>> {
  try {
    const db = resolveDb(dbOverride);
    const current = await ensureTenantLoopState(db, tenantId);
    const now = Math.floor(Date.now() / 1000);

    const transition = transitionAutonomousState(
      current.state as AutonomousEngineState,
      event,
      {
        consecutiveFailures: current.consecutive_failures,
        maxConsecutiveFailuresThreshold: 5,
        isBudgetExceeded: false,
        pauseReason: opts.pauseReason,
        now,
      },
    );

    const consecutiveFailures = opts.resetFailures ? 0 : current.consecutive_failures;
    const lastHeartbeat = opts.updateHeartbeat ? now : current.last_heartbeat_at;
    const lastError = opts.lastError !== undefined ? opts.lastError : current.last_error;

    const updateRes = await db
      .prepare(
        `UPDATE autonomous_loop_state
         SET state = ?1, version = version + 1, updated_at = ?2,
             last_heartbeat_at = ?3, consecutive_failures = ?4, last_error = ?5
         WHERE id = ?6 AND version = ?7`,
      )
      .bind(
        transition.nextState,
        now,
        lastHeartbeat,
        consecutiveFailures,
        lastError,
        current.id,
        current.version,
      )
      .run();

    if (!updateRes.meta.changes) {
      return {
        success: false,
        error: 'Concurrency conflict: loop state version mismatch, please retry',
      };
    }

    return { success: true, data: transition };
  } catch (err) {
    logger.error(`[Autonomous Land Action] ${event} transition error`, {
      tenantId,
      error: String(err),
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

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
