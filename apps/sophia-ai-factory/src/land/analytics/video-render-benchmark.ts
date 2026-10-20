/**
 * Video render benchmark — P27.
 *
 * Computes p50/p95/p99 render durations across `video_jobs` for terminal
 * statuses ('uploaded', 'published'). Returns a flat summary suitable for
 * the admin /api/admin/benchmarks/video-render endpoint.
 *
 * Honest about sample size: when n < MIN_SAMPLES, percentiles still compute
 * but the response includes `low_confidence: true` so admins know not to
 * publish numbers externally.
 */

import {
  MIN_SAMPLES,
  PROMISE_THRESHOLD,
  RENDER_STAGE_THRESHOLD,
  TERMINAL_STATUS,
  percentile,
  type BenchmarkParams,
  type BenchmarkRow,
  type BenchmarkSummary,
  type D1Lite,
} from './video-render-benchmark-types';

export type {
  BenchmarkParams,
  BenchmarkRow,
  BenchmarkSummary,
} from './video-render-benchmark-types';

/**
 * Pure aggregator — pass an array of `{duration_seconds}` rows and get the summary.
 * Kept separate from the D1 query so it can be unit-tested without DB.
 */
export function summariseBenchmarkRows(
  rows: BenchmarkRow[],
  params: BenchmarkParams = {},
): BenchmarkSummary {
  const windowSeconds = params.windowSeconds ?? 7 * 24 * 3600;
  const tier = params.tier ?? null;
  const sampleSize = rows.length;

  if (sampleSize === 0) {
    return {
      sample_size: 0,
      window_seconds: windowSeconds,
      tier,
      durations_seconds: null,
      low_confidence: true,
      promise_threshold_seconds: PROMISE_THRESHOLD,
      render_stage_threshold_seconds: RENDER_STAGE_THRESHOLD,
      percent_under_promise: null,
      percent_under_render_stage: null,
    };
  }

  const sorted = rows.map((r) => r.duration_seconds).sort((a, b) => a - b);
  const sum = sorted.reduce((acc, n) => acc + n, 0);
  const underPromise = sorted.filter((d) => d <= PROMISE_THRESHOLD).length;
  const underRenderStage = sorted.filter((d) => d <= RENDER_STAGE_THRESHOLD).length;

  return {
    sample_size: sampleSize,
    window_seconds: windowSeconds,
    tier,
    durations_seconds: {
      min: sorted[0],
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      max: sorted[sorted.length - 1],
      avg: Math.round((sum / sampleSize) * 100) / 100,
    },
    low_confidence: sampleSize < MIN_SAMPLES,
    promise_threshold_seconds: PROMISE_THRESHOLD,
    render_stage_threshold_seconds: RENDER_STAGE_THRESHOLD,
    percent_under_promise: Math.round((underPromise / sampleSize) * 1000) / 10,
    percent_under_render_stage: Math.round((underRenderStage / sampleSize) * 1000) / 10,
  };
}

/**
 * Query the production `videos` table for terminal rows in the window and
 * compute the summary. `completed_at - created_at` is the render duration;
 * `completed_at` is set exactly once on the 'completed' status transition
 * (migration 0113), so this is stable even when intermediate stages bump
 * `updated_at`.
 */
export async function computeVideoRenderBenchmark(
  db: D1Lite,
  params: BenchmarkParams = {},
): Promise<BenchmarkSummary> {
  const windowSeconds = params.windowSeconds ?? 7 * 24 * 3600;
  const since = Math.floor(Date.now() / 1000) - windowSeconds;
  const sql = `
    SELECT (completed_at - created_at) AS duration_seconds
    FROM videos
    WHERE status = ?
      AND created_at >= ?
      AND completed_at IS NOT NULL
      AND completed_at > created_at
  `;
  const binds: unknown[] = [TERMINAL_STATUS, since];

  const { results } = await db.prepare(sql).bind(...binds).all<BenchmarkRow>();
  return summariseBenchmarkRows(results ?? [], params);
}
