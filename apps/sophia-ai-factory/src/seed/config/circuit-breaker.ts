/**
 * Circuit Breaker Configuration
 *
 * Per-kind cooldown durations and state transition thresholds.
 * Modeled after OmniRoute's per-provider cooldown system:
 * different failure kinds get different cooldown windows.
 *
 * @module seed/config/circuit-breaker
 */

import { CircuitState, FailureKind } from '@/seed/types/failure-kind'

/** Cooldown configuration per failure kind (milliseconds) */
export const FAILURE_COOLDOWNS: Record<FailureKind, number> = {
  [FailureKind.AUTH_FAILURE]: 0,          // Immediate — no retry for bad keys
  [FailureKind.RATE_LIMIT]: 60_000,       // 60 seconds
  [FailureKind.TIMEOUT]: 120_000,         // 2 minutes
  [FailureKind.NETWORK]: 180_000,         // 3 minutes
  [FailureKind.SERVER_ERROR]: 300_000,    // 5 minutes
  [FailureKind.UNKNOWN]: 120_000,         // 2 minutes (conservative default)
  [FailureKind.PROVIDER_NOT_CERTIFIED]: 0, // Immediate — certification is a permanent gate, not a transient failure
  [FailureKind.OWNERSHIP_FAILURE]: 0,     // Immediate — authz failure
  [FailureKind.BILLING_FAILURE]: 0,       // Immediate — quota/entitlement failure
  [FailureKind.PROVIDER_AUTH_FAILURE]: 0, // Immediate — bad provider credentials
  [FailureKind.PROVIDER_CAPABILITY_FAILURE]: 0, // Immediate — unsupported capability
  [FailureKind.MISSION_FAILURE]: 60_000,  // 1 minute cooldown
  [FailureKind.STORAGE_FAILURE]: 120_000, // 2 minutes cooldown
  [FailureKind.WEBHOOK_FAILURE]: 60_000,  // 1 minute cooldown
}

/** State transition thresholds */
export interface CircuitBreakerThresholds {
  /** Failure count to transition from CLOSED → DEGRADED */
  degradedThreshold: number
  /** Failure count to transition from DEGRADED → OPEN */
  openThreshold: number
  /** Time window (ms) in which failures are counted */
  failureWindowMs: number
  /** Maximum services tracked (LRU eviction above this) */
  maxServices: number
}

export const DEFAULT_THRESHOLDS: CircuitBreakerThresholds = {
  degradedThreshold: 3,
  openThreshold: 5,
  failureWindowMs: 60_000, // 1 minute window
  /** Per-key cardinality: provider:tenant entries need higher ceiling */
  maxServices: 2_000,
}

/** Circuit breaker state persisted to D1 */
export interface CircuitBreakerRow {
  service: string
  state: CircuitState
  failure_count: number
  last_failure_at: string | null
  cooldown_until: string | null
  created_at: string
  updated_at: string
}

/** In-memory representation of circuit breaker state */
export interface CircuitBreakerEntry {
  service: string
  state: CircuitState
  failureCount: number
  lastFailureAt: number | null
  cooldownUntil: number | null
  /** Last time this entry was accessed (for LRU eviction) */
  lastAccessAt: number
  /** Lockout (cooldown) duration override for this specific entry; 0 means default per-kind cooldown. */
  lockoutSeconds: number
  /** Count of consecutive NETWORK-level failures on this entry. */
  consecutiveConnectionFailures: number
  /** Timestamp of the last NETWORK failure on this entry. */
  lastConnectionFailureAt: number | null
  /** End of the connection-driven cool-down window (ms epoch). Rejects even when state is CLOSED. */
  connectionCooldownUntil: number | null
}

/** Get cooldown duration for a failure kind */
export function getCooldownMs(kind: FailureKind): number {
  return FAILURE_COOLDOWNS[kind]
}

/** Check if a failure kind should immediately open the circuit */
export function shouldImmediateOpen(kind: FailureKind): boolean {
  return kind === FailureKind.AUTH_FAILURE || kind === FailureKind.PROVIDER_NOT_CERTIFIED
}
