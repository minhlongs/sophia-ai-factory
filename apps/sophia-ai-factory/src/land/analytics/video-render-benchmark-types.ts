/**
 * Types and percentile helper for video render benchmark.
 * @module land/analytics/video-render-benchmark-types
 */

export const MIN_SAMPLES = 10;
export const TERMINAL_STATUS = 'completed';
export const PROMISE_THRESHOLD = 40 * 60;

export interface BenchmarkParams {
  /** Look-back window in seconds. Defaults to 7 days. */
  windowSeconds?: number;
  /** Filter by tier (BASIC | PREMIUM | ENTERPRISE | MASTER). Optional. */
  tier?: string;
}

export interface BenchmarkRow {
  duration_seconds: number;
}

export interface BenchmarkSummary {
  sample_size: number;
  window_seconds: number;
  tier: string | null;
  durations_seconds: {
    min: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
    avg: number;
  } | null;
  /** True when sample_size < MIN_SAMPLES (10). */
  low_confidence: boolean;
  /** Promise threshold: 40 minutes = 2400 seconds. */
  promise_threshold_seconds: number;
  /** Percentage of samples that finished under threshold. */
  percent_under_promise: number | null;
}

export interface D1Lite {
  prepare: (sql: string) => {
    bind: (...args: unknown[]) => {
      all<T = unknown>(): Promise<{ results: T[] | null }>;
    };
  };
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1);
  return sorted[idx];
}
