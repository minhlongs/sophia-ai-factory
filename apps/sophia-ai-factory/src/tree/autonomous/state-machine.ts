/**
 * Autonomous Engine Deterministic Finite State Machine (FSM)
 *
 * Layer: tree/autonomous (Pure domain engine, zero side effects, zero DB dependencies)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module tree/autonomous/state-machine
 */

import type {
  AutonomousEngineState,
  AutonomousStateEvent,
  StateTransitionContext,
  StateTransitionResult,
} from '@/seed/types/autonomous-engine';
import {
  AutonomousEngineError,
  AutonomousStateTransitionError,
  AutonomousCircuitBrokenError,
  AutonomousBudgetLimitExceededError,
} from './state-machine-errors';
import {
  TRANSITION_MATRIX,
  type TransitionResolution,
  type TransitionResolver,
} from './state-machine-matrix';

export const DEFAULT_MAX_CONSECUTIVE_FAILURES = 5;

export {
  AutonomousEngineError,
  AutonomousStateTransitionError,
  AutonomousCircuitBrokenError,
  AutonomousBudgetLimitExceededError,
  TRANSITION_MATRIX,
  type TransitionResolution,
  type TransitionResolver,
};

/**
 * Evaluates state transition deterministically.
 *
 * @param currentState Current state of the engine
 * @param event Event attempting to trigger a state transition
 * @param context Optional transition context parameters
 * @returns StateTransitionResult
 * @throws AutonomousStateTransitionError if transition is undefined or illegal
 */
export function transitionAutonomousState(
  currentState: AutonomousEngineState,
  event: AutonomousStateEvent,
  context?: Partial<StateTransitionContext>
): StateTransitionResult {
  const maxFailures = (context as { maxConsecutiveFailures?: number } | undefined)?.maxConsecutiveFailures
    ?? context?.maxConsecutiveFailuresThreshold
    ?? DEFAULT_MAX_CONSECUTIVE_FAILURES;

  const ctx: StateTransitionContext = {
    consecutiveFailures: context?.consecutiveFailures ?? 0,
    maxConsecutiveFailuresThreshold: maxFailures,
    isBudgetExceeded: context?.isBudgetExceeded ?? false,
    error: context?.error ?? null,
    now: context?.now ?? Date.now(),
    cycleId: context?.cycleId,
    pauseReason: context?.pauseReason,
    isForceCycle: context?.isForceCycle,
  };

  const stateResolvers = TRANSITION_MATRIX[currentState];
  const resolver = stateResolvers?.[event];

  if (!resolver) {
    throw new AutonomousStateTransitionError(currentState, event);
  }

  const resolution = resolver(ctx);
  const changed = currentState !== resolution.nextState;

  return {
    previousState: currentState,
    currentState: resolution.nextState,
    nextState: resolution.nextState,
    event,
    changed,
    allowed: true,
    reason: resolution.reason,
    timestamp: ctx.now,
    resetFailureCount: resolution.resetFailureCount ?? false,
  };
}

/**
 * Validates whether an event can be legally processed from a given state without throwing.
 */
export function canTransition(
  currentState: AutonomousEngineState,
  event: AutonomousStateEvent
): boolean {
  return Boolean(TRANSITION_MATRIX[currentState]?.[event]);
}
