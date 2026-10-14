/**
 * Circuit Breaker Types & Constants
 *
 * Layer: seed/utils/circuit-breaker
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitStatus {
  state: CircuitState;
  openedAt?: number;
  recentFailures: number;
  recentSuccesses: number;
}

export type CircuitBreakerOptions = {
  failureThreshold?: number;
  cooldownMs?: number;
  onOpen?: () => void;
  onHalfOpen?: () => void;
};

export interface DispatchDecision {
  allowed: boolean;
  reason?: string;
}

export interface AttemptEntry {
  ts: number;
  ok: boolean;
}

export interface KvCircuitData {
  openedAt?: number;
  halfOpenProbeAllowed?: boolean;
}

export const KV_STATE_KEY = 'circuit:heygen';
export const KV_LOG_KEY = 'circuit:heygen:log';
export const MAX_LOG_ENTRIES = 50;
export const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
export const FAILURE_RATE_THRESHOLD = 0.5; // 50%
export const MIN_ATTEMPTS_TO_OPEN = 10;
export const HALF_OPEN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
export const KV_TTL_SECONDS = 2 * 60 * 60; // 2h data retention
