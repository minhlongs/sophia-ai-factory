/**
 * @module tree/media-jobs/media-job-economics-query
 *
 * Provider reliability metrics computation (SUPREME COMMAND #9 — Phase 4).
 *
 * Pure functions that take raw media_jobs rows and compute
 * reliability metrics per provider.
 *
 * Layer rule: tree — imports from seed only.
 */

import {
  calculatePercentile,
  classifyJobDataConfidence,
  type MediaJobMetricsRow,
  type ProviderReliabilityMetrics,
} from './media-job-percentile-math';

export {
  calculatePercentile,
  type MediaJobMetricsRow,
  type ProviderReliabilityMetrics,
};

/**
 * Compute reliability metrics from raw media_jobs rows.
 *
 * @param rows — Raw query rows with status, latency_ms, retry_count
 * @param windowSeconds — Time window these rows represent (for metadata)
 * @param provider — Provider identifier (for labeling)
 */
export function computeProviderMetrics(
  rows: MediaJobMetricsRow[],
  windowSeconds: number,
  provider: string = 'unknown',
): ProviderReliabilityMetrics {
  const totalJobs = rows.length;

  if (totalJobs === 0) {
    return {
      provider,
      windowSeconds,
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      successRate: null,
      failureRate: null,
      p50LatencyMs: null,
      p95LatencyMs: null,
      retryRate: null,
      dataConfidence: 'INSUFFICIENT',
    };
  }

  const successfulJobs = rows.filter((r) => r.status === 'completed').length;
  const failedJobs = rows.filter((r) => r.status === 'failed').length;

  const successRate = (successfulJobs / totalJobs) * 100;
  const failureRate = (failedJobs / totalJobs) * 100;

  // Latency percentiles — only from rows with valid latency
  const latencies = rows
    .map((r) => r.latency_ms)
    .filter((l): l is number => l !== null && l !== undefined)
    .sort((a, b) => a - b);

  const p50LatencyMs = calculatePercentile(latencies, 50);
  const p95LatencyMs = calculatePercentile(latencies, 95);

  // Retry rate — fraction of jobs that had at least one retry
  const jobsWithRetries = rows.filter(
    (r) => r.retry_count !== null && r.retry_count !== undefined && r.retry_count > 0,
  ).length;
  const retryRate = (jobsWithRetries / totalJobs) * 100;

  return {
    provider,
    windowSeconds,
    totalJobs,
    successfulJobs,
    failedJobs,
    successRate: Math.round(successRate * 100) / 100,
    failureRate: Math.round(failureRate * 100) / 100,
    p50LatencyMs,
    p95LatencyMs,
    retryRate: Math.round(retryRate * 100) / 100,
    dataConfidence: classifyJobDataConfidence(totalJobs),
  };
}
