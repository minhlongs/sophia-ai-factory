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
 *
 * @param current Current status record
 * @param action Event ('SUCCESS' | 'FAILURE' | 'PROBE' | 'RESET')
 * @param now Current epoch timestamp in ms (defaults to Date.now())
 */
export function evaluateCircuitStatus(
  current: CircuitEvaluationInput,
  action: 'SUCCESS' | 'FAILURE' | 'PROBE' | 'RESET',
  now: number = Date.now()
): CircuitEvaluationOutput {
  const rawStatus = (current as { status?: CircuitStatus | CircuitBreakerStatus }).status;
  const statusObj = typeof rawStatus === 'object' && rawStatus !== null ? rawStatus : null;

  const currentState: CircuitState =
    statusObj?.state ??
    (typeof rawStatus === 'string' ? rawStatus : undefined) ??
    (current as { state?: CircuitState }).state ??
    'CLOSED';

  const cooldown =
    statusObj?.cooldownPeriodMs ??
    (current as { cooldownMs?: number }).cooldownMs ??
    (current as { cooldownPeriodMs?: number }).cooldownPeriodMs ??
    DEFAULT_CIRCUIT_CONFIG.cooldownPeriodMs;

  const failureThreshold =
    statusObj?.failureThreshold ??
    (current as { failureThreshold?: number }).failureThreshold ??
    DEFAULT_CIRCUIT_CONFIG.failureThreshold;

  let nextState: CircuitState = currentState;
  let nextFailures = statusObj?.consecutiveFailures ?? current.consecutiveFailures ?? 0;
  let nextLastFailureAt = statusObj?.lastFailureAt ?? current.lastFailureAt ?? null;
  let nextLastStateChangeAt = statusObj?.lastStateChangeAt ?? current.lastStateChangeAt ?? now;
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
      if (currentState === 'HALF_OPEN') {
        nextState = 'CLOSED';
        nextFailures = 0;
        nextLastStateChangeAt = now;
        recovered = true;
      } else if (currentState === 'CLOSED') {
        nextFailures = 0;
      } else if (currentState === 'OPEN') {
        nextState = 'CLOSED';
        nextFailures = 0;
        nextLastStateChangeAt = now;
        recovered = true;
      }
      break;
    }

    case 'FAILURE': {
      nextFailures = (current.consecutiveFailures ?? 0) + 1;
      nextLastFailureAt = now;

      if (currentState === 'HALF_OPEN') {
        nextState = 'OPEN';
        nextLastStateChangeAt = now;
        tripped = true;
      } else if (currentState === 'CLOSED') {
        if (nextFailures >= failureThreshold) {
          nextState = 'OPEN';
          nextLastStateChangeAt = now;
          tripped = true;
        }
      }
      break;
    }

    case 'PROBE': {
      if (currentState === 'OPEN') {
        const lastRef = nextLastFailureAt ?? nextLastStateChangeAt;
        const elapsed = now - lastRef;
        if (elapsed >= cooldown) {
          nextState = 'HALF_OPEN';
          nextLastStateChangeAt = now;
        }
      }
      break;
    }
  }

  const lastRef = nextLastFailureAt ?? nextLastStateChangeAt;
  const cooldownRemainingMs =
    nextState === 'OPEN' ? Math.max(0, cooldown - (now - lastRef)) : 0;

  const allowRequest = nextState === 'CLOSED' || nextState === 'HALF_OPEN';

  const updatedStatus: CircuitBreakerStatus = {
    serviceOrSkill:
      (current as { serviceOrSkill?: string }).serviceOrSkill ??
      (current as { service?: string }).service ??
      'default',
    state: nextState,
    consecutiveFailures: nextFailures,
    failureThreshold,
    cooldownPeriodMs: cooldown,
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
