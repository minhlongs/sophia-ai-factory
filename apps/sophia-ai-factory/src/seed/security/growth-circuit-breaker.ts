/**
 * Seed Layer: Growth Queue & API Circuit Breaker
 * Fail-closed circuit breaker protection against downstream AI and video provider failures.
 * Layer: seed/security | Max LOC: < 200 | Zero :any
 * @module seed/security/growth-circuit-breaker
 */

import {
  CircuitState,
  FailureClassification,
} from '@/seed/types/growth-triad-v14';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  cooldownPeriodMs: number;
}

export interface CircuitBreakerStateRecord {
  resourceId: string;
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureTime: number;
  lastSuccessTime: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  cooldownPeriodMs: 60 * 1000, // 1 minute
};

/**
 * Classifies an unknown error into standard failure classification.
 */
export function classifyGrowthError(error: unknown): FailureClassification {
  if (!error) return 'UNKNOWN_ERROR';
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'TRANSIENT_RATE_LIMIT';
  }
  if (lower.includes('timeout') || lower.includes('econnreset') || lower.includes('504')) {
    return 'DOWNSTREAM_TIMEOUT';
  }
  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('invalid api key')) {
    return 'INVALID_BYOK_KEY';
  }
  if (lower.includes('validation') || lower.includes('schema') || lower.includes('400')) {
    return 'PERMANENT_SCHEMA_ERROR';
  }
  return 'UNKNOWN_ERROR';
}

/**
 * Pure evaluator for circuit breaker transitions.
 */
export function evaluateCircuitState(
  current: CircuitBreakerStateRecord,
  now: number,
  config: CircuitBreakerConfig = DEFAULT_CONFIG
): CircuitState {
  if (current.state === 'OPEN') {
    // Check if cooldown period elapsed
    if (now - current.lastFailureTime >= config.cooldownPeriodMs) {
      return 'HALF_OPEN';
    }
    return 'OPEN';
  }
  return current.state;
}

/**
 * Pure record update upon failure.
 */
export function recordCircuitFailure(
  current: CircuitBreakerStateRecord,
  classification: FailureClassification,
  now: number,
  config: CircuitBreakerConfig = DEFAULT_CONFIG
): CircuitBreakerStateRecord {
  // Authentication failure trips immediately
  if (classification === 'INVALID_BYOK_KEY') {
    return {
      ...current,
      state: 'OPEN',
      consecutiveFailures: current.consecutiveFailures + 1,
      lastFailureTime: now,
    };
  }

  const failures = current.consecutiveFailures + 1;
  const state: CircuitState = failures >= config.failureThreshold ? 'OPEN' : 'CLOSED';

  return {
    ...current,
    state,
    consecutiveFailures: failures,
    lastFailureTime: now,
  };
}

/**
 * Pure record update upon success.
 */
export function recordCircuitSuccess(
  current: CircuitBreakerStateRecord,
  now: number
): CircuitBreakerStateRecord {
  return {
    ...current,
    state: 'CLOSED',
    consecutiveFailures: 0,
    lastSuccessTime: now,
  };
}
