'use server';

/**
 * Autonomous Loop Lifecycle Server Actions
 *
 * Layer: land/autonomous
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module land/autonomous/loop-actions-lifecycle
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  AutonomousEngineState,
  AutonomousStateEvent,
  StateTransitionResult,
} from '@/seed/types/autonomous-engine';
import { transitionAutonomousState } from '@/tree/autonomous/state-machine';
import {
  resolveDb,
  ensureTenantLoopState,
  type ActionResult,
} from './loop-actions-db';

interface TransitionOpts {
  reason?: string;
  resetFailures?: boolean;
  clearError?: boolean;
  updateHeartbeat?: boolean;
  error?: string | null;
}

async function executeLoopTransition(
  tenantId: string,
  event: AutonomousStateEvent,
  opts: TransitionOpts = {},
  dbOverride?: unknown
): Promise<ActionResult<StateTransitionResult>> {
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
        pauseReason: opts.reason,
        now,
      }
    );

    const nextFailures = opts.resetFailures ? 0 : current.consecutive_failures;
    const nextError = opts.clearError ? null : (opts.error ?? current.last_error);
    const nextHeartbeat = opts.updateHeartbeat ? now : current.last_heartbeat_at;

    const updateRes = await db
      .prepare(
        `UPDATE autonomous_loop_state
         SET state = ?1, consecutive_failures = ?2, last_error = ?3,
             last_heartbeat_at = ?4, version = version + 1, updated_at = ?5
         WHERE id = ?6 AND version = ?7`
      )
      .bind(
        transition.nextState,
        nextFailures,
        nextError,
        nextHeartbeat,
        now,
        current.id,
        current.version
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
    logger.error(`[Autonomous Land Action] transition ${event} error`, {
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
  dbOverride?: unknown
): Promise<ActionResult<StateTransitionResult>> {
  return executeLoopTransition(tenantId, 'START', { updateHeartbeat: true }, dbOverride);
}

/**
 * Action: Pause the autonomous execution loop.
 */
export async function pauseAutonomousLoopAction(
  reason: string = 'Manual operator pause',
  tenantId: string = 'default',
  dbOverride?: unknown
): Promise<ActionResult<StateTransitionResult>> {
  return executeLoopTransition(tenantId, 'PAUSE_CMD', { reason }, dbOverride);
}

/**
 * Action: Resume the autonomous execution loop from PAUSED to IDLE.
 */
export async function resumeAutonomousLoopAction(
  tenantId: string = 'default',
  dbOverride?: unknown
): Promise<ActionResult<StateTransitionResult>> {
  return executeLoopTransition(tenantId, 'RESUME_CMD', { updateHeartbeat: true }, dbOverride);
}

/**
 * Action: Emergency Halt — immediate suspension to PAUSED from any state.
 */
export async function emergencyHaltAutonomousLoopAction(
  reason: string = 'Emergency stop triggered by operator',
  tenantId: string = 'default',
  dbOverride?: unknown
): Promise<ActionResult<StateTransitionResult>> {
  return executeLoopTransition(
    tenantId,
    'EMERGENCY_HALT',
    { reason, error: reason },
    dbOverride
  );
}

/**
 * Action: Reset Circuit Breaker (CIRCUIT_BROKEN -> IDLE).
 */
export async function resetCircuitBreakerAction(
  tenantId: string = 'default',
  dbOverride?: unknown
): Promise<ActionResult<StateTransitionResult>> {
  return executeLoopTransition(
    tenantId,
    'MANUAL_RESET',
    { resetFailures: true, clearError: true },
    dbOverride
  );
}
