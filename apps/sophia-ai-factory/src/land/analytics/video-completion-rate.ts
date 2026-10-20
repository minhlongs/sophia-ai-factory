/**
 * Video completion rate — the SLI half the render benchmark does not answer.
 *
 * `video-render-benchmark` reports how fast successful renders were. It cannot
 * report how many jobs ever finished, because it only counts rows already in a
 * success state. That distinction matters for the SLO: a shrinking sample of
 * successes looks identical to a healthy pipeline in the benchmark, but is a
 * collapsing completion rate.
 *
 * Terminal states are 'completed' (success) and 'failed_permanent' (the video
 * pipeline's exhausted-retry terminal). In-flight statuses are reported
 * separately and never counted against the rate, so a backlog of queued work
 * is visible without dragging the number down before those jobs resolve.
 *
 * @module land/analytics/video-completion-rate
 */

import { MIN_SAMPLES, type D1Lite } from './video-render-benchmark-types';

export interface CompletionCounts {
  completed: number;
  failed: number;
  processing: number;
  /** Terminal jobs: completed + failed. In-flight work is excluded. */
  eligible: number;
}

export interface CompletionSummary {
  eligible_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  in_flight_jobs: number;
  /** Percentage of eligible jobs that completed, one decimal place. */
  completion_rate: number;
  /** True when eligible_jobs < MIN_SAMPLES. */
  low_confidence: boolean;
  sample_floor: number;
}

/** Pure aggregator — kept separate from the D1 query so it unit-tests without DB. */
export function summariseCompletionRows(counts: CompletionCounts): CompletionSummary {
  const { eligible, completed, failed, processing } = counts;

  if (eligible <= 0) {
    return {
      eligible_jobs: 0,
      completed_jobs: completed,
      failed_jobs: failed,
      in_flight_jobs: processing,
      completion_rate: 0,
      low_confidence: true,
      sample_floor: MIN_SAMPLES,
    };
  }

  return {
    eligible_jobs: eligible,
    completed_jobs: completed,
    failed_jobs: failed,
    in_flight_jobs: processing,
    completion_rate: Math.round((completed / eligible) * 1000) / 10,
    low_confidence: eligible < MIN_SAMPLES,
    sample_floor: MIN_SAMPLES,
  };
}

/**
 * Count terminal and in-flight video jobs within the look-back window.
 *
 * `created_at` bounds the window so a job accepted before the window but
 * finished inside it is not counted: the SLI describes work the pipeline was
 * given during the period, not work that merely landed during it.
 */
export async function computeVideoCompletionRate(
  db: D1Lite,
  params: { windowSeconds?: number } = {},
): Promise<CompletionSummary> {
  const windowSeconds = params.windowSeconds ?? 7 * 24 * 3600;
  const since = Math.floor(Date.now() / 1000) - windowSeconds;

  const sql = `
    SELECT
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status = 'failed_permanent' THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN status NOT IN ('completed', 'failed_permanent') THEN 1 ELSE 0 END) AS processing
    FROM videos
    WHERE created_at >= ?
  `;

  const { results } = await db.prepare(sql).bind(since).all<{
    completed: number | null; failed: number | null; processing: number | null;
  }>();

  const row = results?.[0];
  const completed = Number(row?.completed ?? 0);
  const failed = Number(row?.failed ?? 0);
  const processing = Number(row?.processing ?? 0);

  return summariseCompletionRows({
    completed, failed, processing, eligible: completed + failed,
  });
}
