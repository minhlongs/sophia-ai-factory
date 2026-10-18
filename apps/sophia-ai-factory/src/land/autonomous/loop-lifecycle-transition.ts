/**
 * Autonomous FSM Lifecycle Transition Helper
 * Land Layer - Optimistic locking state transitions in D1
 *
 * @module land/autonomous/loop-lifecycle-transition
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

export interface LifecycleOpts {
  pauseReason?: string;
  resetFailures?: boolean;
  updateHeartbeat?: boolean;
  lastError?: string | null;
}

export async function performLifecycleTransition(
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
