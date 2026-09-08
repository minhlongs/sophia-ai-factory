/**
 * @module tree/media-jobs/provider-health-policy
 *
 * Provider health classification policy (SUPREME COMMAND #9 — Phase 6).
 *
 * Pure function that maps reliability metrics to a discrete health status
 * using configurable thresholds. No I/O, no side effects.
 *
 * Layer rule: tree — imports from seed only.
 */

import type { ProviderReliabilityMetrics } from './media-job-economics-query';

// ── Types ────────────────────────────────────────────────────────────────────

export type ProviderHealthStatus =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'UNHEALTHY'
  | 'INSUFFICIENT_DATA';

export interface ProviderHealthAssessment {
  provider: string;
  status: ProviderHealthStatus;
  reasons: string[];
  metrics: ProviderReliabilityMetrics;
  assessedAt: number;
}

export interface HealthPolicyConfig {
  minSampleSize: number;
  unhealthySuccessRate: number;
  unhealthyP95LatencyMs: number;
  degradedSuccessRate: number;
  degradedP95LatencyMs: number;
  degradedFailureRate: number;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_HEALTH_POLICY: HealthPolicyConfig = {
  minSampleSize: 10,
  unhealthySuccessRate: 70,
  unhealthyP95LatencyMs: 30000,
  degradedSuccessRate: 90,
  degradedP95LatencyMs: 15000,
  degradedFailureRate: 5,
};

// ── Policy ───────────────────────────────────────────────────────────────────

/**
 * Assess provider health from reliability metrics.
 *
 * Rule order (first match wins):
 * 1. INSUFFICIENT_DATA — totalJobs < minSampleSize
 * 2. UNHEALTHY — successRate < unhealthySuccessRate
 *              OR (successRate < unhealthySuccessRate + 15 AND p95 > unhealthyP95LatencyMs)
 * 3. DEGRADED — successRate < degradedSuccessRate
 *              OR p95 > degradedP95LatencyMs
 *              OR failureRate > degradedFailureRate
 * 4. HEALTHY — everything else
 */
export function assessProviderHealth(
  metrics: ProviderReliabilityMetrics,
  config: Partial<HealthPolicyConfig> = {},
): ProviderHealthAssessment {
  const cfg: HealthPolicyConfig = { ...DEFAULT_HEALTH_POLICY, ...config };
  const reasons: string[] = [];
  const assessedAt = Math.floor(Date.now() / 1000);

  // 1. Insufficient data
  if (metrics.totalJobs < cfg.minSampleSize) {
    return {
      provider: metrics.provider,
      status: 'INSUFFICIENT_DATA',
      reasons: [`Sample size ${metrics.totalJobs} below minimum ${cfg.minSampleSize}`],
      metrics,
      assessedAt,
    };
  }

  const successRate = metrics.successRate ?? 0;
  const failureRate = metrics.failureRate ?? 0;
  const p95 = metrics.p95LatencyMs ?? 0;

  // 2. Unhealthy
  const hardUnhealthy = successRate < cfg.unhealthySuccessRate;
  const latencyUnhealthy =
    successRate < cfg.unhealthySuccessRate + 15 && p95 > cfg.unhealthyP95LatencyMs;

  if (hardUnhealthy) {
    reasons.push(`Success rate ${successRate.toFixed(1)}% below ${cfg.unhealthySuccessRate}%`);
  }
  if (latencyUnhealthy) {
    reasons.push(
      `Success rate ${successRate.toFixed(1)}% with p95 latency ${p95}ms exceeding ${cfg.unhealthyP95LatencyMs}ms`,
    );
  }
  if (hardUnhealthy || latencyUnhealthy) {
    return {
      provider: metrics.provider,
      status: 'UNHEALTHY',
      reasons,
      metrics,
      assessedAt,
    };
  }

  // 3. Degraded
  const degradedSuccess = successRate < cfg.degradedSuccessRate;
  const degradedLatency = p95 > cfg.degradedP95LatencyMs;
  const degradedFailure = failureRate > cfg.degradedFailureRate;

  if (degradedSuccess) {
    reasons.push(`Success rate ${successRate.toFixed(1)}% below ${cfg.degradedSuccessRate}%`);
  }
  if (degradedLatency) {
    reasons.push(`p95 latency ${p95}ms exceeding ${cfg.degradedP95LatencyMs}ms`);
  }
  if (degradedFailure) {
    reasons.push(`Failure rate ${failureRate.toFixed(1)}% above ${cfg.degradedFailureRate}%`);
  }
  if (degradedSuccess || degradedLatency || degradedFailure) {
    return {
      provider: metrics.provider,
      status: 'DEGRADED',
      reasons,
      metrics,
      assessedAt,
    };
  }

  // 4. Healthy
  return {
    provider: metrics.provider,
    status: 'HEALTHY',
    reasons: ['All metrics within healthy thresholds'],
    metrics,
    assessedAt,
  };
}
