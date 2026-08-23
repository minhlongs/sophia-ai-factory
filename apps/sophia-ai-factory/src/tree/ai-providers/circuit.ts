// DEPRECATED: tracked in DEPRECATION_REGISTRY (seed/types/deprecation-markers.ts, target 'tree/ai-providers') — removal eligible after 2026-09-06.
/**
 * Circuit Breaker Integration for AI Providers.
 *
 * Thin adapter over seed/security/circuit-breaker.ts that provides
 * provider-scoped circuit operations and exposes the current CircuitState.
 *
 * @module tree/ai-providers/circuit
 */

import {
  recordSuccess as cbRecordSuccess,
  recordFailure as cbRecordFailure,
  shouldAllowRequest,
  getState,
} from '@/seed/security/circuit-breaker'
import { CircuitState, FailureKind } from '@/seed/types/failure-kind'

export { FailureKind }
export type { CircuitState }

/**
 * Record a successful call to a provider.
 * Resets the circuit to CLOSED.
 */
export function recordSuccess(providerId: string): void {
  cbRecordSuccess(providerId)
}

/**
 * Record a failed call to a provider.
 * @param kind - failure classification that determines cooldown and state transition
 */
export function recordFailure(providerId: string, kind: FailureKind): void {
  cbRecordFailure(providerId, kind)
}

/**
 * Check whether the circuit allows a request to a provider.
 * Returns false when circuit is OPEN (cooldown) or HALF_OPEN (probe in flight).
 */
export function canAttempt(providerId: string): boolean {
  return shouldAllowRequest(providerId)
}

/**
 * Get the current circuit state for a provider.
 * Returns the full entry so callers can inspect failure count, cooldown, etc.
 */
export function getCircuitState(providerId: string): CircuitState {
  return getState(providerId).state
}
