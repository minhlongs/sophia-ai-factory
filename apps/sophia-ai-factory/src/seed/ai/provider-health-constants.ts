/**
 * @module seed/ai/provider-health-constants
 *
 * Constants and initial state factory for ProviderHealthTracker.
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

import type { ProviderHealth } from './provider-interface';

/** Consecutive failures before a provider is marked unhealthy. */
export const FAILURE_THRESHOLD = 3;

/** Cooldown duration after exceeding the failure threshold (ms). */
export const COOLDOWN_MS = 30_000;

/** Maximum samples kept for rolling average latency. */
export const LATENCY_WINDOW_SIZE = 20;

export function createInitialProviderHealthState(): ProviderHealth {
  return {
    healthy: true,
    inCooldown: false,
    avgLatencyMs: 0,
    lastSuccess: 0,
    lastFailure: 0,
    consecutiveFailures: 0,
    totalRequests: 0,
    totalSuccesses: 0,
    totalFailures: 0,
  };
}

export function computeRollingLatency(samples: number[], newSample: number): number {
  samples.push(newSample);
  if (samples.length > LATENCY_WINDOW_SIZE) {
    samples.shift();
  }
  const sum = samples.reduce((a, b) => a + b, 0);
  return Math.round(sum / samples.length);
}
