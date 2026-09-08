/**
 * Unit tests for provider-health-policy health classification.
 *
 * @module tree/media-jobs/__tests__/provider-health-policy
 */

import { describe, it, expect } from 'vitest';
import {
  assessProviderHealth,
  DEFAULT_HEALTH_POLICY,
} from '../provider-health-policy';
import type { ProviderReliabilityMetrics } from '../media-job-economics-query';

function makeMetrics(overrides: Partial<ProviderReliabilityMetrics> = {}): ProviderReliabilityMetrics {
  return {
    provider: 'test',
    windowSeconds: 86400,
    totalJobs: 100,
    successfulJobs: 90,
    failedJobs: 10,
    successRate: 90,
    failureRate: 10,
    p50LatencyMs: 1000,
    p95LatencyMs: 5000,
    retryRate: 5,
    dataConfidence: 'HIGH',
    ...overrides,
  };
}

describe('assessProviderHealth', () => {
  it('test 15: insufficient data classification with <10 jobs', () => {
    const metrics = makeMetrics({ totalJobs: 5, successRate: 100, failureRate: 0 });
    const assessment = assessProviderHealth(metrics);
    expect(assessment.status).toBe('INSUFFICIENT_DATA');
    expect(assessment.reasons[0]).toContain('below minimum');
  });

  it('test 16: degraded provider classification — successRate 85', () => {
    const metrics = makeMetrics({ successRate: 85, failureRate: 15, p95LatencyMs: 5000 });
    const assessment = assessProviderHealth(metrics);
    expect(assessment.status).toBe('DEGRADED');
  });

  it('test 17: unhealthy provider classification — successRate 50', () => {
    const metrics = makeMetrics({ successRate: 50, failureRate: 50, p95LatencyMs: 5000 });
    const assessment = assessProviderHealth(metrics);
    expect(assessment.status).toBe('UNHEALTHY');
  });

  it('classifies HEALTHY when all thresholds met', () => {
    const metrics = makeMetrics({ successRate: 95, failureRate: 3, p95LatencyMs: 5000 });
    const assessment = assessProviderHealth(metrics);
    expect(assessment.status).toBe('HEALTHY');
  });

  it('classifies DEGRADED when p95 latency exceeds threshold', () => {
    const metrics = makeMetrics({ successRate: 95, failureRate: 3, p95LatencyMs: 20000 });
    const assessment = assessProviderHealth(metrics);
    expect(assessment.status).toBe('DEGRADED');
  });

  it('classifies DEGRADED when failure rate exceeds threshold', () => {
    const metrics = makeMetrics({ successRate: 92, failureRate: 8, p95LatencyMs: 5000 });
    const assessment = assessProviderHealth(metrics);
    expect(assessment.status).toBe('DEGRADED');
  });

  it('classifies UNHEALTHY via latency rule (successRate < 85 AND p95 > 30000)', () => {
    const metrics = makeMetrics({ successRate: 80, failureRate: 5, p95LatencyMs: 40000 });
    const assessment = assessProviderHealth(metrics);
    expect(assessment.status).toBe('UNHEALTHY');
  });

  it('uses custom config thresholds', () => {
    const metrics = makeMetrics({ totalJobs: 8, successRate: 100, failureRate: 0 });
    const assessment = assessProviderHealth(metrics, { minSampleSize: 5 });
    // With minSampleSize=5, 8 jobs is sufficient
    expect(assessment.status).toBe('HEALTHY');
  });

  it('includes provider and timestamp in assessment', () => {
    const metrics = makeMetrics({ provider: 'flux' });
    const before = Math.floor(Date.now() / 1000);
    const assessment = assessProviderHealth(metrics);
    expect(assessment.provider).toBe('flux');
    expect(assessment.assessedAt).toBeGreaterThanOrEqual(before);
    expect(assessment.metrics).toBe(metrics);
  });

  it('exposes default policy config', () => {
    expect(DEFAULT_HEALTH_POLICY.minSampleSize).toBe(10);
    expect(DEFAULT_HEALTH_POLICY.unhealthySuccessRate).toBe(70);
    expect(DEFAULT_HEALTH_POLICY.degradedSuccessRate).toBe(90);
  });
});
