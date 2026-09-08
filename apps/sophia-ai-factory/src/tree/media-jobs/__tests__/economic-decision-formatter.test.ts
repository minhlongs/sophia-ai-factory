/**
 * Unit tests for economic-decision-formatter.
 *
 * @module tree/media-jobs/__tests__/economic-decision-formatter
 */

import { describe, it, expect } from 'vitest';
import { formatEconomicDecision } from '../economic-decision-formatter';
import type { ProviderHealthAssessment } from '../provider-health-policy';
import type { ProviderEconomicMetrics } from '../media-job-economics-aggregate';
import type { ProviderReliabilityMetrics } from '../media-job-economics-query';

function makeReliability(overrides: Partial<ProviderReliabilityMetrics> = {}): ProviderReliabilityMetrics {
  return {
    provider: 'flux',
    windowSeconds: 86400,
    totalJobs: 100,
    successfulJobs: 85,
    failedJobs: 15,
    successRate: 85,
    failureRate: 15,
    p50LatencyMs: 1200,
    p95LatencyMs: 4500,
    retryRate: 10,
    dataConfidence: 'HIGH',
    ...overrides,
  };
}

function makeHealth(overrides: Partial<ProviderHealthAssessment> = {}): ProviderHealthAssessment {
  return {
    provider: 'flux',
    status: 'HEALTHY',
    reasons: ['All metrics within healthy thresholds'],
    metrics: makeReliability(),
    assessedAt: 1700000000,
    ...overrides,
  };
}

function makeEconomics(overrides: Partial<ProviderEconomicMetrics> = {}): ProviderEconomicMetrics {
  return {
    provider: 'flux',
    totalJobs: 100,
    successfulJobs: 85,
    failedJobs: 15,
    knownCostJobs: 80,
    unknownCostJobs: 20,
    totalKnownProviderCost: 12300,
    averageKnownCostPerJob: 153.75,
    revenueAttributed: 45600,
    knownGrossMarginPercent: 72.5,
    attributionProvenanceCount: 80,
    dataConfidence: 'HIGH',
    ...overrides,
  };
}

describe('formatEconomicDecision', () => {
  it('formats all fields correctly with complete data', () => {
    const output = formatEconomicDecision(makeHealth(), makeEconomics());
    expect(output.provider).toBe('flux');
    expect(output.status).toBe('HEALTHY');
    expect(output.jobs).toBe(100);
    expect(output.successRate).toBe('85.0%');
    expect(output.p50).toBe('1200 ms');
    expect(output.p95).toBe('4500 ms');
    expect(output.knownCost).toBe('$123.00');
    expect(output.unknownCostJobs).toBe(20);
    expect(output.revenueAttributed).toBe('$456.00');
    expect(output.knownGrossMargin).toBe('72.5%');
    expect(output.dataConfidence).toBe('HIGH');
  });

  it('formats UNKNOWN for null economic values', () => {
    const economics = makeEconomics({
      totalKnownProviderCost: null,
      revenueAttributed: null,
      knownGrossMarginPercent: null,
    });
    const output = formatEconomicDecision(makeHealth(), economics);
    expect(output.knownCost).toBe('UNKNOWN');
    expect(output.revenueAttributed).toBe('UNKNOWN');
    expect(output.knownGrossMargin).toBe('UNKNOWN');
  });

  it('formats N/A for null latency values', () => {
    const health = makeHealth({
      metrics: makeReliability({ p50LatencyMs: null, p95LatencyMs: null }),
    });
    const output = formatEconomicDecision(health, makeEconomics());
    expect(output.p50).toBe('N/A');
    expect(output.p95).toBe('N/A');
  });

  it('returns MEDIUM confidence for 50-99 jobs', () => {
    const economics = makeEconomics({ totalJobs: 60, knownCostJobs: 50 });
    const output = formatEconomicDecision(makeHealth(), economics);
    expect(output.dataConfidence).toBe('MEDIUM');
  });

  it('returns LOW confidence for <50 jobs', () => {
    const economics = makeEconomics({ totalJobs: 30, knownCostJobs: 20 });
    const output = formatEconomicDecision(makeHealth(), economics);
    expect(output.dataConfidence).toBe('LOW');
  });

  it('returns HIGH confidence only when knownRatio >= 0.8 AND totalJobs >= 100', () => {
    const economics = makeEconomics({ totalJobs: 100, knownCostJobs: 80 });
    const output = formatEconomicDecision(makeHealth(), economics);
    expect(output.dataConfidence).toBe('HIGH');
  });
});
