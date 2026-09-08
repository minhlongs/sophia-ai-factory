/**
 * Unit tests for media-job-economics-query reliability metrics.
 *
 * @module tree/media-jobs/__tests__/media-job-economics-query
 */

import { describe, it, expect } from 'vitest';
import {
  computeProviderMetrics,
  calculatePercentile,
} from '../media-job-economics-query';

describe('computeProviderMetrics', () => {
  it('test 1: all-success rows produce 100% success rate', () => {
    const rows = Array.from({ length: 10 }, () => ({
      status: 'completed',
      latency_ms: 1000,
      retry_count: 0,
    }));
    const metrics = computeProviderMetrics(rows, 86400, 'flux');
    expect(metrics.successRate).toBe(100);
    expect(metrics.failedJobs).toBe(0);
    expect(metrics.successfulJobs).toBe(10);
  });

  it('test 2: all-failure rows produce 100% failure rate', () => {
    const rows = Array.from({ length: 10 }, () => ({
      status: 'failed',
      latency_ms: 500,
      retry_count: 2,
    }));
    const metrics = computeProviderMetrics(rows, 86400, 'elevenlabs');
    expect(metrics.failureRate).toBe(100);
    expect(metrics.successRate).toBe(0);
    expect(metrics.failedJobs).toBe(10);
  });

  it('test 11: 5/10 success -> 50% success rate', () => {
    const rows = [
      ...Array.from({ length: 5 }, () => ({ status: 'completed' as const, latency_ms: 100, retry_count: 0 })),
      ...Array.from({ length: 5 }, () => ({ status: 'failed' as const, latency_ms: 100, retry_count: 0 })),
    ];
    const metrics = computeProviderMetrics(rows, 86400, 'test');
    expect(metrics.successRate).toBe(50);
  });

  it('test 12: 3/10 failure -> 30% failure rate', () => {
    const rows = [
      ...Array.from({ length: 7 }, () => ({ status: 'completed' as const, latency_ms: 100, retry_count: 0 })),
      ...Array.from({ length: 3 }, () => ({ status: 'failed' as const, latency_ms: 100, retry_count: 0 })),
    ];
    const metrics = computeProviderMetrics(rows, 86400, 'test');
    expect(metrics.failureRate).toBe(30);
  });

  it('test 10: retry counting sums jobs with retries', () => {
    const rows = [
      { status: 'completed' as const, latency_ms: 100, retry_count: 2 },
      { status: 'completed' as const, latency_ms: 100, retry_count: 0 },
      { status: 'failed' as const, latency_ms: 100, retry_count: 1 },
      { status: 'completed' as const, latency_ms: 100, retry_count: 0 },
    ];
    const metrics = computeProviderMetrics(rows, 86400, 'test');
    // 2 of 4 jobs had retries -> 50%
    expect(metrics.retryRate).toBe(50);
  });

  it('returns null rates for empty rows', () => {
    const metrics = computeProviderMetrics([], 86400, 'empty');
    expect(metrics.successRate).toBeNull();
    expect(metrics.failureRate).toBeNull();
    expect(metrics.p50LatencyMs).toBeNull();
    expect(metrics.p95LatencyMs).toBeNull();
    expect(metrics.dataConfidence).toBe('INSUFFICIENT');
  });
});

describe('calculatePercentile', () => {
  it('test 13: median of [1,2,3,4,5] === 3', () => {
    expect(calculatePercentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });

  it('test 14: P95 of [1..100] via linear interpolation (test 14)', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    const p95 = calculatePercentile(values, 95);
    // Linear interpolation: index = 0.95 * 99 = 94.05
    // values[94] = 95, values[95] = 96 -> 95 + 0.05*(96-95) = 95.05
    expect(p95).toBeCloseTo(95.05, 2);
  });

  it('returns null for empty array', () => {
    expect(calculatePercentile([], 50)).toBeNull();
  });

  it('returns null for invalid percentile', () => {
    expect(calculatePercentile([1, 2, 3], -1)).toBeNull();
    expect(calculatePercentile([1, 2, 3], 101)).toBeNull();
  });

  it('returns single value for single-element array', () => {
    expect(calculatePercentile([42], 50)).toBe(42);
  });
});
