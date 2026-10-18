/**
 * @module tree/media-jobs/provider-health-policy-types
 *
 * Types and default thresholds for provider health classification policy.
 */

import type { ProviderReliabilityMetrics } from './media-job-economics-query';

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

export const DEFAULT_HEALTH_POLICY: HealthPolicyConfig = {
  minSampleSize: 10,
  unhealthySuccessRate: 70,
  unhealthyP95LatencyMs: 30000,
  degradedSuccessRate: 90,
  degradedP95LatencyMs: 15000,
  degradedFailureRate: 5,
};
