/**
 * Types and configuration constants for GPU mesh failover engine.
 *
 * @module tree/queue/failover/types
 */

import type {
  GpuProvider,
  CircuitBreakerState,
} from '@/seed/types/video-render-queue';

/**
 * Default fallback chain across providers
 */
export const DEFAULT_PROVIDER_CHAIN: readonly GpuProvider[] = [
  'fal',
  'runpod',
  'replicate',
  'mekong',
] as const;

/**
 * Circuit breaker configuration options
 */
export interface CircuitBreakerConfig {
  /** Consecutive failures required to trip circuit from CLOSED to OPEN (default: 3) */
  failureThreshold: number;
  /** Consecutive successes in HALF_OPEN required to close the circuit (default: 2) */
  successThreshold: number;
  /** Time in milliseconds to remain OPEN before probing via HALF_OPEN (default: 30000ms = 30s) */
  cooldownPeriodMs: number;
  /** Per-provider execution timeout in milliseconds (default: 120000ms = 2m) */
  executionTimeoutMs?: number;
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  successThreshold: 2,
  cooldownPeriodMs: 30_000,
  executionTimeoutMs: 120_000,
};

/**
 * State record for an individual provider's circuit breaker
 */
export interface ProviderState {
  state: CircuitBreakerState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  cooldownUntil?: number;
  lastLatencyMs?: number;
}

/**
 * Result details for a single provider execution attempt
 */
export interface ProviderAttemptRecord {
  provider: GpuProvider;
  status: 'success' | 'failed' | 'skipped_circuit_open';
  error?: string;
  durationMs: number;
}

/**
 * Full execution result returned by mesh failover
 */
export interface MeshExecutionResult<T> {
  result: T;
  provider: GpuProvider;
  attempts: ProviderAttemptRecord[];
  totalDurationMs: number;
}
