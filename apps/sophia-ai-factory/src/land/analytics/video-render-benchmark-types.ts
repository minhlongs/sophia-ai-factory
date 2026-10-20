/**
 * Types and percentile helper for video render benchmark.
 * @module land/analytics/video-render-benchmark-types
 */

export const MIN_SAMPLES = 10;
export const TERMINAL_STATUS = 'completed';
/** Whole-flow promise the customer copy makes: 40 minutes end to end. */
export const PROMISE_THRESHOLD = 40 * 60;
/**
 * Render-stage target: the AI-video component of the same customer copy, which
 * breaks the 40-minute flow into 10 minutes of AI video generation.
 *
 * Deliberately separate from PROMISE_THRESHOLD. The whole-flow number tolerates
 * scripting, voice-over, editing, and upload; a render that consumed the entire
 * 40-minute budget would still be "under promise" while breaking the 10-minute
 * step the copy actually commits to.
 */
export const RENDER_STAGE_THRESHOLD = 10 * 60;

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
  /** Whole-flow promise threshold: 40 minutes = 2400 seconds. */
  promise_threshold_seconds: number;
  /** Percentage of samples that finished under the whole-flow threshold. */
  percent_under_promise: number | null;
  /** Render-stage threshold: 10 minutes = 600 seconds. */
  render_stage_threshold_seconds: number;
  /** Percentage of samples that finished under the render-stage threshold. */
  percent_under_render_stage: number | null;
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
