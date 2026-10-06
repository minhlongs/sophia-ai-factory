/**
 * Autonomous Engine State Machine Types
 *
 * Layer: seed/types (Foundational - zero upper-layer imports)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module seed/types/autonomous-fsm
 */

export const AUTONOMOUS_ENGINE_STATES = [
  'IDLE',
  'RUNNING',
  'PAUSED',
  'RECOVERING',
  'CIRCUIT_BROKEN',
] as const;
export type AutonomousEngineState = (typeof AUTONOMOUS_ENGINE_STATES)[number];

export const AUTONOMOUS_STATE_EVENTS = [
  'START',
  'TRIGGER_CYCLE',
  'CYCLE_SUCCESS',
  'NO_TASKS_DUE',
  'TASK_FAILURE',
  'RECOVERY_SUCCESS',
  'MAX_RETRIES_EXCEEDED',
  'CONSECUTIVE_FAILURES',
  'CRITICAL_ERROR',
  'PAUSE_CMD',
  'RESUME_CMD',
  'FORCE_CYCLE_CMD',
  'EMERGENCY_HALT',
  'COOLDOWN_EXPIRED',
  'MANUAL_RESET',
  'BUDGET_EXCEEDED',
] as const;
export type AutonomousStateEvent = (typeof AUTONOMOUS_STATE_EVENTS)[number];

export interface StateTransitionContext {
  cycleId?: string;
  consecutiveFailures: number;
  maxConsecutiveFailuresThreshold: number;
  isBudgetExceeded: boolean;
  error?: string | null;
  now: number;
  pauseReason?: string;
  isForceCycle?: boolean;
}

export interface StateTransitionResult {
  previousState: AutonomousEngineState;
  currentState: AutonomousEngineState;
  nextState: AutonomousEngineState;
  event: AutonomousStateEvent;
  changed: boolean;
  allowed: boolean;
  reason: string;
  timestamp: number;
  resetFailureCount: boolean;
}
