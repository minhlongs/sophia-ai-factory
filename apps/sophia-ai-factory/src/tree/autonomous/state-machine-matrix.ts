/**
 * Autonomous Engine Deterministic Transition Matrix
 * Layer: tree/autonomous (Pure domain engine, zero side effects)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 * @module tree/autonomous/state-machine-matrix
 */

import type {
  AutonomousEngineState,
  AutonomousStateEvent,
  StateTransitionContext,
} from '@/seed/types/autonomous-engine';

export interface TransitionResolution {
  nextState: AutonomousEngineState;
  resetFailureCount?: boolean;
  reason: string;
}

export type TransitionResolver = (ctx: StateTransitionContext) => TransitionResolution;

export const TRANSITION_MATRIX: Partial<
  Record<AutonomousEngineState, Partial<Record<AutonomousStateEvent, TransitionResolver>>>
> = {
  IDLE: {
    START: (ctx) => ctx.isBudgetExceeded
      ? { nextState: 'PAUSED', reason: 'Cannot start cycle: budget limit exceeded' }
      : { nextState: 'RUNNING', reason: 'Autonomous cycle started' },
    TRIGGER_CYCLE: (ctx) => ctx.isBudgetExceeded
      ? { nextState: 'PAUSED', reason: 'Cannot trigger cycle: budget limit exceeded' }
      : { nextState: 'RUNNING', reason: 'Autonomous cycle triggered by schedule or event' },
    PAUSE_CMD: () => ({ nextState: 'PAUSED', reason: 'Administrative pause command received while idle' }),
    BUDGET_EXCEEDED: () => ({ nextState: 'PAUSED', reason: 'Spending limit exceeded; entering paused state' }),
    MANUAL_RESET: () => ({ nextState: 'IDLE', resetFailureCount: true, reason: 'Manual reset applied (idempotent)' }),
    EMERGENCY_HALT: () => ({ nextState: 'PAUSED', reason: 'Emergency halt triggered while idle' }),
  },

  RUNNING: {
    CYCLE_SUCCESS: () => ({ nextState: 'IDLE', resetFailureCount: true, reason: 'Cycle completed successfully; returning to idle' }),
    NO_TASKS_DUE: () => ({ nextState: 'IDLE', reason: 'No scheduled tasks currently due; returning to idle' }),
    TASK_FAILURE: (ctx) => {
      const failures = ctx.consecutiveFailures + 1;
      if (failures >= ctx.maxConsecutiveFailuresThreshold) {
        return { nextState: 'CIRCUIT_BROKEN', reason: `Maximum consecutive failures reached (${failures}); circuit tripped` };
      }
      return { nextState: 'RECOVERING', reason: 'Task execution failed; initiating recovery/backoff' };
    },
    CONSECUTIVE_FAILURES: () => ({ nextState: 'CIRCUIT_BROKEN', reason: 'Maximum consecutive failures reached; circuit tripped' }),
    CRITICAL_ERROR: () => ({ nextState: 'CIRCUIT_BROKEN', reason: 'Fatal unrecoverable error encountered; circuit tripped' }),
    PAUSE_CMD: () => ({ nextState: 'PAUSED', reason: 'Administrative pause command received during active cycle' }),
    EMERGENCY_HALT: () => ({ nextState: 'PAUSED', reason: 'Emergency halt received; cycle aborted immediately' }),
    BUDGET_EXCEEDED: () => ({ nextState: 'PAUSED', reason: 'Quota exhausted during cycle execution; paused' }),
  },

  RECOVERING: {
    RECOVERY_SUCCESS: () => ({ nextState: 'RUNNING', reason: 'Recovery succeeded; resuming cycle execution' }),
    MAX_RETRIES_EXCEEDED: (ctx) => {
      if (ctx.consecutiveFailures >= ctx.maxConsecutiveFailuresThreshold) {
        return {
          nextState: 'CIRCUIT_BROKEN',
          reason: `Max retries exhausted and failure threshold reached (${ctx.consecutiveFailures}/${ctx.maxConsecutiveFailuresThreshold}); circuit tripped`,
        };
      }
      return { nextState: 'IDLE', reason: 'Task retry attempts exhausted; task quarantined to DLQ, returning to idle' };
    },
    CONSECUTIVE_FAILURES: () => ({ nextState: 'CIRCUIT_BROKEN', reason: 'Consecutive failures threshold crossed during recovery; circuit tripped' }),
    CRITICAL_ERROR: () => ({ nextState: 'CIRCUIT_BROKEN', reason: 'Critical error encountered during recovery; circuit tripped' }),
    PAUSE_CMD: () => ({ nextState: 'PAUSED', reason: 'Administrative pause command received during recovery' }),
    EMERGENCY_HALT: () => ({ nextState: 'PAUSED', reason: 'Emergency halt received during recovery' }),
  },

  PAUSED: {
    RESUME_CMD: (ctx) => ctx.isBudgetExceeded
      ? { nextState: 'PAUSED', reason: 'Cannot resume: spending limit remains exceeded' }
      : { nextState: 'IDLE', reason: 'Administrative resume command accepted; entering idle' },
    FORCE_CYCLE_CMD: () => ({ nextState: 'RUNNING', reason: 'Administrative override: forced single cycle run from paused state' }),
    PAUSE_CMD: () => ({ nextState: 'PAUSED', reason: 'Engine is already paused (idempotent)' }),
    EMERGENCY_HALT: () => ({ nextState: 'PAUSED', reason: 'Engine is already paused/halted (idempotent)' }),
  },

  CIRCUIT_BROKEN: {
    COOLDOWN_EXPIRED: () => ({ nextState: 'RECOVERING', reason: 'Circuit cooldown period elapsed; entering half-open recovery probe' }),
    MANUAL_RESET: () => ({ nextState: 'IDLE', resetFailureCount: true, reason: 'Operator manual reset applied; circuit restored to idle' }),
    EMERGENCY_HALT: () => ({ nextState: 'PAUSED', reason: 'Emergency halt received while circuit broken; state transitioned to paused' }),
    PAUSE_CMD: () => ({ nextState: 'PAUSED', reason: 'Administrative pause applied to circuit broken engine' }),
    CRITICAL_ERROR: () => ({ nextState: 'CIRCUIT_BROKEN', reason: 'Critical error while circuit broken (idempotent)' }),
  },
};
