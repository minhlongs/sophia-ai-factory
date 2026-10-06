'use server';

/**
 * Autonomous Loop Lifecycle Actions (FSM State Transitions)
 *
 * Layer: land/autonomous
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module land/autonomous/loop-lifecycle-actions
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  AutonomousEngineState,
  StateTransitionResult,
} from '@/seed/types/autonomous-engine';
import { transitionAutonomousState } from '@/tree/autonomous/state-machine';
import {
  resolveDb,
  ensureTenantLoopState,
  type ActionResult,
} from './loop-actions-db';

/**
 * Action: Start the autonomous execution loop (IDLE -> RUNNING).
 */
export async function startAutonomousLoopAction(
  tenantId: string = 'default',
  dbOverride?: unknown
): Promise<ActionResult<StateTransitionResult>> {
  try {
    const db = resolveDb(dbOverride);
    const current = await ensureTenantLoopState(db, tenantId);
    const now = Math.floor(Date.now() / 1000);

    const transition = transitionAutonomousState(
      current.state as AutonomousEngineState,
      'START',
      {
        consecutiveFailures: current.consecutive_failures,
        maxConsecutiveFailuresThreshold: 5,
        isBudgetExceeded: false,
        now,
      }
    );

    const updateRes = await db
      .prepare(
        `UPDATE autonomous_loop_state
         SET state = ?1, version = version + 1, updated_at = ?2, last_heartbeat_at = ?3
         WHERE id = ?4 AND version = ?5`
      )
      .bind(transition.nextState, now, now, current.id, current.version)
      .run();

    if (!updateRes.meta.changes) {
      return {
        success: false,
        error: 'Concurrency conflict: loop state version mismatch, please retry',
      };
    }

    return { success: true, data: transition };
  } catch (err) {
    logger.error('[Autonomous Land Action] startAutonomousLoopAction error', {
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
 * Action: Pause the autonomous execution loop.
 */
export async function pauseAutonomousLoopAction(
  reason: string = 'Manual operator pause',
  tenantId: string = 'default',
  dbOverride?: unknown
): Promise<ActionResult<StateTransitionResult>> {
  try {
    const db = resolveDb(dbOverride);
    const current = await ensureTenantLoopState(db, tenantId);
    const now = Math.floor(Date.now() / 1000);

    const transition = transitionAutonomousState(
      current.state as AutonomousEngineState,
      'PAUSE_CMD',
      {
        consecutiveFailures: current.consecutive_failures,
        maxConsecutiveFailuresThreshold: 5,
        isBudgetExceeded: false,
        pauseReason: reason,
        now,
      }
    );

    const updateRes = await db
      .prepare(
        `UPDATE autonomous_loop_state
         SET state = ?1, version = version + 1, updated_at = ?2
         WHERE id = ?3 AND version = ?4`
      )
      .bind(transition.nextState, now, current.id, current.version)
      .run();

    if (!updateRes.meta.changes) {
      return {
        success: false,
        error: 'Concurrency conflict: loop state version mismatch, please retry',
      };
    }

    return { success: true, data: transition };
  } catch (err) {
    logger.error('[Autonomous Land Action] pauseAutonomousLoopAction error', {
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
 * Action: Resume the autonomous execution loop from PAUSED to IDLE.
 */
export async function resumeAutonomousLoopAction(
  tenantId: string = 'default',
  dbOverride?: unknown
): Promise<ActionResult<StateTransitionResult>> {
  try {
    const db = resolveDb(dbOverride);
    const current = await ensureTenantLoopState(db, tenantId);
    const now = Math.floor(Date.now() / 1000);

    const transition = transitionAutonomousState(
      current.state as AutonomousEngineState,
      'RESUME_CMD',
      {
        consecutiveFailures: current.consecutive_failures,
        maxConsecutiveFailuresThreshold: 5,
        isBudgetExceeded: false,
        now,
      }
    );

    const updateRes = await db
      .prepare(
        `UPDATE autonomous_loop_state
         SET state = ?1, version = version + 1, updated_at = ?2, last_heartbeat_at = ?3
         WHERE id = ?4 AND version = ?5`
      )
      .bind(transition.nextState, now, now, current.id, current.version)
      .run();

    if (!updateRes.meta.changes) {
      return {
        success: false,
        error: 'Concurrency conflict: loop state version mismatch, please retry',
      };
    }

    return { success: true, data: transition };
  } catch (err) {
    logger.error('[Autonomous Land Action] resumeAutonomousLoopAction error', {
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
 * Action: Emergency Halt — immediate suspension to PAUSED from any state.
 */
export async function emergencyHaltAutonomousLoopAction(
  reason: string = 'Emergency stop triggered by operator',
  tenantId: string = 'default',
  dbOverride?: unknown
): Promise<ActionResult<StateTransitionResult>> {
  try {
    const db = resolveDb(dbOverride);
    const current = await ensureTenantLoopState(db, tenantId);
    const now = Math.floor(Date.now() / 1000);

    const transition = transitionAutonomousState(
      current.state as AutonomousEngineState,
      'EMERGENCY_HALT',
      {
        consecutiveFailures: current.consecutive_failures,
        maxConsecutiveFailuresThreshold: 5,
        isBudgetExceeded: false,
        pauseReason: reason,
        now,
      }
    );

    const updateRes = await db
      .prepare(
        `UPDATE autonomous_loop_state
         SET state = ?1, version = version + 1, updated_at = ?2, last_error = ?3
         WHERE id = ?4 AND version = ?5`
      )
      .bind(transition.nextState, now, reason, current.id, current.version)
      .run();

    if (!updateRes.meta.changes) {
      return {
        success: false,
        error: 'Concurrency conflict: loop state version mismatch, please retry',
      };
    }

    return { success: true, data: transition };
  } catch (err) {
    logger.error('[Autonomous Land Action] emergencyHaltAutonomousLoopAction error', {
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
 * Action: Reset Circuit Breaker (CIRCUIT_BROKEN -> IDLE).
 */
export async function resetCircuitBreakerAction(
  tenantId: string = 'default',
  dbOverride?: unknown
): Promise<ActionResult<StateTransitionResult>> {
  try {
    const db = resolveDb(dbOverride);
    const current = await ensureTenantLoopState(db, tenantId);
    const now = Math.floor(Date.now() / 1000);

    const transition = transitionAutonomousState(
      current.state as AutonomousEngineState,
      'MANUAL_RESET',
      {
        consecutiveFailures: current.consecutive_failures,
        maxConsecutiveFailuresThreshold: 5,
        isBudgetExceeded: false,
        now,
      }
    );

    const updateRes = await db
      .prepare(
        `UPDATE autonomous_loop_state
         SET state = ?1, consecutive_failures = 0, last_error = NULL,
             version = version + 1, updated_at = ?2
         WHERE id = ?3 AND version = ?4`
      )
      .bind(transition.nextState, now, current.id, current.version)
      .run();

    if (!updateRes.meta.changes) {
      return {
        success: false,
        error: 'Concurrency conflict: loop state version mismatch, please retry',
      };
    }

    return { success: true, data: transition };
  } catch (err) {
    logger.error('[Autonomous Land Action] resetCircuitBreakerAction error', {
      tenantId,
      error: String(err),
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
