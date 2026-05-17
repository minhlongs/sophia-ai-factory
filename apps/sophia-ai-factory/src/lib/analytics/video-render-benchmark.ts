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

const MIN_SAMPLES = 10;
const TERMINAL_STATUSES = ['uploaded', 'published'] as const;

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

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1);
  return sorted[idx];
}

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
  const PROMISE_THRESHOLD = 40 * 60;

  if (sampleSize === 0) {
    return {
      sample_size: 0,
      window_seconds: windowSeconds,
      tier,
      durations_seconds: null,
      low_confidence: true,
      promise_threshold_seconds: PROMISE_THRESHOLD,
      percent_under_promise: null,
    };
  }

  const sorted = rows.map((r) => r.duration_seconds).sort((a, b) => a - b);
  const sum = sorted.reduce((acc, n) => acc + n, 0);
  const underPromise = sorted.filter((d) => d <= PROMISE_THRESHOLD).length;

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
    percent_under_promise: Math.round((underPromise / sampleSize) * 1000) / 10,
  };
}

interface D1Lite {
  prepare: (sql: string) => {
    bind: (...args: unknown[]) => {
      all<T = unknown>(): Promise<{ results: T[] | null }>;
    };
  };
}

/**
 * Query `video_jobs` for terminal rows in the window and compute the summary.
 * `completed_at - created_at` is the render duration; `completed_at` is set
 * exactly once on terminal status transition (migration 0113), so this is
 * stable even when intermediate stages bump `updated_at`.
 */
export async function computeVideoRenderBenchmark(
  db: D1Lite,
  params: BenchmarkParams = {},
): Promise<BenchmarkSummary> {
  const windowSeconds = params.windowSeconds ?? 7 * 24 * 3600;
  const since = Math.floor(Date.now() / 1000) - windowSeconds;
  const statusList = TERMINAL_STATUSES.map(() => '?').join(',');
  const tierFilter = params.tier ? ' AND tier = ?' : '';
  const sql = `
    SELECT (completed_at - created_at) AS duration_seconds
    FROM video_jobs
    WHERE status IN (${statusList})
      AND created_at >= ?
      AND completed_at IS NOT NULL
      AND completed_at > created_at${tierFilter}
  `;
  const binds: unknown[] = [...TERMINAL_STATUSES, since];
  if (params.tier) binds.push(params.tier);

  const { results } = await db.prepare(sql).bind(...binds).all<BenchmarkRow>();
  return summariseBenchmarkRows(results ?? [], params);
}
