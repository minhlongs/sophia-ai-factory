/**
 * Autonomous Engine Two-Tier Circuit Breaker Evaluator
 *
 * Layer: tree/autonomous (Pure domain engine, zero side effects)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module tree/autonomous/circuit-breaker
 */

import type {
  CircuitBreakerStatus,
  CircuitState,
  CircuitStatus,
} from '@/seed/types/autonomous-engine';
import {
  DEFAULT_CIRCUIT_CONFIG,
  createInitialCircuitStatus,
  getRemainingCooldownMs,
  isCircuitAvailable,
  type CircuitEvaluationInput,
  type CircuitEvaluationOutput,
} from './circuit-breaker-status';
import { normalizeCircuitInput } from './circuit-breaker-transition';

export {
  DEFAULT_CIRCUIT_CONFIG,
  createInitialCircuitStatus,
  getRemainingCooldownMs,
  isCircuitAvailable,
  type CircuitBreakerStatus,
  type CircuitState,
  type CircuitStatus,
  type CircuitEvaluationInput,
  type CircuitEvaluationOutput,
};

/**
 * Pure state evaluator for Circuit Breaker.
 */
export function evaluateCircuitStatus(
  current: CircuitEvaluationInput,
  action: 'SUCCESS' | 'FAILURE' | 'PROBE' | 'RESET',
  now: number = Date.now()
): CircuitEvaluationOutput {
  const norm = normalizeCircuitInput(current, now);
  let nextState: CircuitState = norm.currentState;
  let nextFailures = norm.initialFailures;
  let nextLastFailureAt = norm.initialLastFailureAt;
  let nextLastStateChangeAt = norm.initialLastStateChangeAt;
  let tripped = false;
  let recovered = false;

  switch (action) {
    case 'RESET': {
      nextState = 'CLOSED';
      nextFailures = 0;
      nextLastStateChangeAt = now;
      recovered = true;
      break;
    }
    case 'SUCCESS': {
      if (norm.currentState === 'HALF_OPEN' || norm.currentState === 'OPEN') {
        nextState = 'CLOSED';
        nextFailures = 0;
        nextLastStateChangeAt = now;
        recovered = true;
      } else if (norm.currentState === 'CLOSED') {
        nextFailures = 0;
      }
      break;
    }
    case 'FAILURE': {
      nextFailures = (current.consecutiveFailures ?? 0) + 1;
      nextLastFailureAt = now;
      if (norm.currentState === 'HALF_OPEN' || (norm.currentState === 'CLOSED' && nextFailures >= norm.failureThreshold)) {
        nextState = 'OPEN';
        nextLastStateChangeAt = now;
        tripped = true;
      }
      break;
    }
    case 'PROBE': {
      if (norm.currentState === 'OPEN') {
        const lastRef = nextLastFailureAt ?? nextLastStateChangeAt;
        if (now - lastRef >= norm.cooldown) {
          nextState = 'HALF_OPEN';
          nextLastStateChangeAt = now;
        }
      }
      break;
    }
  }

  const lastRef = nextLastFailureAt ?? nextLastStateChangeAt;
  const cooldownRemainingMs =
    nextState === 'OPEN' ? Math.max(0, norm.cooldown - (now - lastRef)) : 0;
  const allowRequest = nextState === 'CLOSED' || nextState === 'HALF_OPEN';

  const updatedStatus: CircuitBreakerStatus = {
    serviceOrSkill: norm.serviceOrSkill,
    state: nextState,
    consecutiveFailures: nextFailures,
    failureThreshold: norm.failureThreshold,
    cooldownPeriodMs: norm.cooldown,
    lastFailureAt: nextLastFailureAt,
    lastStateChangeAt: nextLastStateChangeAt,
  };

  return {
    status: updatedStatus,
    state: nextState,
    allowRequest,
    tripped,
    recovered,
    cooldownRemainingMs,
    consecutiveFailures: nextFailures,
    lastFailureAt: nextLastFailureAt,
    lastStateChangeAt: nextLastStateChangeAt,
  };
}
