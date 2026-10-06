/**
 * Autonomous Engine Circuit Breaker Status & Availability
 *
 * Layer: tree/autonomous (Pure domain engine, zero side effects)
 * Conforms to: Sophia 4-Layer Architecture Doctrine
 *
 * @module tree/autonomous/circuit-breaker-status
 */

import type {
  CircuitBreakerStatus,
  CircuitState,
  CircuitStatus,
} from '@/seed/types/autonomous-engine';

export type { CircuitBreakerStatus, CircuitState, CircuitStatus };

export const DEFAULT_CIRCUIT_CONFIG = {
  failureThreshold: 5,        // Trip after 5 consecutive failures
  cooldownPeriodMs: 300_000,  // 5 minutes (300 seconds) cooldown
  cooldownMs: 300_000,
};

export interface CircuitEvaluationOutput {
  status: CircuitBreakerStatus;
  state: CircuitState;
  allowRequest: boolean;
  tripped: boolean;
  recovered: boolean;
  cooldownRemainingMs: number;
  consecutiveFailures: number;
  failureThreshold?: number;
  lastFailureAt: number | null;
  lastStateChangeAt: number;
}

export type CircuitEvaluationInput =
  | CircuitBreakerStatus
  | CircuitEvaluationOutput
  | {
      status?: CircuitStatus | CircuitBreakerStatus;
      state?: CircuitState;
      consecutiveFailures?: number;
      failureThreshold?: number;
      cooldownPeriodMs?: number;
      cooldownMs?: number;
      lastFailureAt?: number | null;
      lastStateChangeAt?: number;
      serviceOrSkill?: string;
    };

/**
 * Creates initial circuit breaker status for a service or skill.
 */
export function createInitialCircuitStatus(
  serviceOrSkill: string,
  overrides?: Partial<CircuitBreakerStatus>
): CircuitBreakerStatus {
  const now = Date.now();
  return {
    serviceOrSkill,
    state: overrides?.state ?? 'CLOSED',
    consecutiveFailures: overrides?.consecutiveFailures ?? 0,
    failureThreshold: overrides?.failureThreshold ?? DEFAULT_CIRCUIT_CONFIG.failureThreshold,
    cooldownPeriodMs: overrides?.cooldownPeriodMs ?? DEFAULT_CIRCUIT_CONFIG.cooldownPeriodMs,
    lastFailureAt: overrides?.lastFailureAt ?? null,
    lastStateChangeAt: overrides?.lastStateChangeAt ?? now,
  };
}

/**
 * Calculates remaining cooldown time in milliseconds if circuit is OPEN.
 */
export function getRemainingCooldownMs(
  status: CircuitBreakerStatus,
  now: number = Date.now()
): number {
  if (status.state !== 'OPEN') {
    return 0;
  }
  const referenceTime = status.lastFailureAt ?? status.lastStateChangeAt;
  const elapsed = now - referenceTime;
  return Math.max(0, status.cooldownPeriodMs - elapsed);
}

/**
 * Evaluates whether a circuit allows requests.
 * Returns true if CLOSED or HALF_OPEN (for canary probe).
 */
export function isCircuitAvailable(
  status: CircuitBreakerStatus,
  now: number = Date.now()
): boolean {
  if (status.state === 'CLOSED') {
    return true;
  }
  if (status.state === 'HALF_OPEN') {
    return true;
  }
  return getRemainingCooldownMs(status, now) === 0;
}
