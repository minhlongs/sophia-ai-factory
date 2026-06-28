/**
 * Types and config for Real-Time Usage Tracker
 * @module usage-metering/realtime-tracker-types
 */

export type CircuitState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxRequests: number;
}

export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  halfOpenRequests: number;
}

export interface RealTimeUsage {
  licenseNonce: string;
  userId: string;
  tier: string;
  currentCredits: number;
  windowStart: number;
  windowMs: number;
}

export const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenMaxRequests: 3,
}
