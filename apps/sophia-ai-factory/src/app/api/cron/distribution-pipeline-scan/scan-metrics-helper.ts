/**
 * Distribution Pipeline Scan Helper — metrics calculation & alert evaluation
 */

export const ALERT_THROTTLE_TTL = 6 * 60 * 60; // 6 hours in KV seconds
const FAILURE_RATE_THRESHOLD = 0.15; // 15%
const LATENCY_MULTIPLIER = 2; // 2x baseline p95
const ZERO_POST_RATIO = 0.2; // 20% of baseline
const MIN_BASELINE_HOURLY = 5; // minimum baseline posts/hour for zero-post check

export interface DistPostRow {
  workspace_id: string;
  platform: string;
  status: string;
  error: string | null;
  created_at: number;
  scheduled_at: number | null;
  posted_at: number | null;
}

export interface PipelineMetricsEvaluation {
  shouldAlert: boolean;
  failedCount: number;
  totalCount: number;
  failureRate: number;
  baselineFailureRate: number;
  p95LatencyMs: number;
  baselineP95LatencyMs: number;
  failureTaxonomy: Record<string, number>;
}

export function groupRowsByWorkspacePlatform(rows: DistPostRow[]): Map<string, DistPostRow[]> {
  const byWorkspacePlatform = new Map<string, DistPostRow[]>();
  for (const row of rows) {
    const key = `${row.workspace_id}:${row.platform}`;
    if (!byWorkspacePlatform.has(key)) {
      byWorkspacePlatform.set(key, []);
    }
    byWorkspacePlatform.get(key)!.push(row);
  }
  return byWorkspacePlatform;
}

export function evaluateWorkspacePlatformMetrics(
  platformRows: DistPostRow[],
  hourAgo: number,
  sevenDaysAgo: number
): PipelineMetricsEvaluation {
  const currentHourRows = platformRows.filter((r) => r.created_at >= hourAgo);
  const totalCount = currentHourRows.length;
  const failedCount = currentHourRows.filter((r) => r.status === 'failed').length;

  const baselineRows = platformRows.filter(
    (r) => r.created_at >= sevenDaysAgo && r.created_at < hourAgo
  );
  const baselineHours = 7 * 24 - 1;
  const baselineFailedHourly = baselineRows.filter((r) => r.status === 'failed').length / baselineHours;
  const baselineTotalHourly = baselineRows.length / baselineHours;

  const failureRate = totalCount > 0 ? failedCount / totalCount : 0;
  const baselineFailureRate = baselineTotalHourly > 0 ? baselineFailedHourly / baselineTotalHourly : 0;

  const publishedCurrent = currentHourRows.filter(
    (r) => r.status === 'published' && r.posted_at && r.scheduled_at
  );
  const latencies = publishedCurrent
    .map((r) => r.posted_at! - r.scheduled_at!)
    .sort((a, b) => a - b);
  const p95LatencyMs =
    latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;

  const publishedBaseline = baselineRows.filter(
    (r) => r.status === 'published' && r.posted_at && r.scheduled_at
  );
  const baselineLatencies = publishedBaseline
    .map((r) => r.posted_at! - r.scheduled_at!)
    .sort((a, b) => a - b);
  const baselineP95LatencyMs =
    baselineLatencies.length > 0 ? baselineLatencies[Math.floor(baselineLatencies.length * 0.95)] : 0;

  const failureTaxonomy: Record<string, number> = {};
  for (const row of currentHourRows.filter((r) => r.status === 'failed' && r.error)) {
    failureTaxonomy[row.error!] = (failureTaxonomy[row.error!] || 0) + 1;
  }

  const zeroPostStall =
    totalCount < baselineTotalHourly * ZERO_POST_RATIO &&
    baselineTotalHourly > MIN_BASELINE_HOURLY;

  const shouldAlert =
    (totalCount > 0 && failureRate > FAILURE_RATE_THRESHOLD && failureRate > baselineFailureRate * 2) ||
    (p95LatencyMs > 0 &&
      baselineP95LatencyMs > 0 &&
      p95LatencyMs > baselineP95LatencyMs * LATENCY_MULTIPLIER) ||
    zeroPostStall;

  return {
    shouldAlert,
    failedCount,
    totalCount,
    failureRate,
    baselineFailureRate,
    p95LatencyMs,
    baselineP95LatencyMs,
    failureTaxonomy,
  };
}
