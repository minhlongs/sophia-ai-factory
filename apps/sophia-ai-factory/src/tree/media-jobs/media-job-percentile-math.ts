/**
 * @module tree/media-jobs/media-job-percentile-math
 *
 * Types and percentile / confidence calculation helpers for media job reliability metrics.
 * Layer rule: tree — imports from seed only.
 */

export interface MediaJobMetricsRow {
  status: string;
  latency_ms: number | null;
  retry_count: number | null;
}

export interface ProviderReliabilityMetrics {
  provider: string;
  windowSeconds: number;
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  successRate: number | null;
  failureRate: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  retryRate: number | null;
  dataConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
}

/**
 * Compute a percentile from a sorted array of values.
 *
 * Uses linear interpolation between adjacent values.
 * Returns null for empty arrays or invalid percentiles.
 */
export function calculatePercentile(
  sortedValues: number[],
  percentile: number,
): number | null {
  if (sortedValues.length === 0) return null;
  if (percentile < 0 || percentile > 100) return null;

  if (sortedValues.length === 1) return sortedValues[0];

  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sortedValues[lower];

  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

export function classifyJobDataConfidence(
  totalJobs: number,
): ProviderReliabilityMetrics['dataConfidence'] {
  if (totalJobs >= 100) return 'HIGH';
  if (totalJobs >= 30) return 'MEDIUM';
  if (totalJobs >= 10) return 'LOW';
  return 'INSUFFICIENT';
}
