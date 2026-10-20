/**
 * Video completion telemetry — emits one WAE point per terminal job outcome.
 *
 * Telemetry only: the SLO calculation reads durable D1 rows, so losing a point
 * (WAE is fire-and-forget) costs observability and never correctness. That is
 * why every failure path here is swallowed rather than propagated.
 *
 * @module land/fulfillment/webhook-completer/video-metric-emitter
 */

import { writeVideoJobToWAE, type VideoJobMetricPoint } from '@/seed/observability/telemetry/wae-client';
import { getWAEBindingForMetrics } from '@/seed/observability/telemetry/metrics';
import { RENDER_STAGE_THRESHOLD } from '@/land/analytics/video-render-benchmark-types';

/**
 * Emit a point for a job that just reached a terminal state.
 *
 * `completedAt`/`createdAt` are unix seconds. A duration of 0 means "unknown"
 * rather than "instant", which happens when `created_at` is missing or in the
 * future; Consumers should treat 0 as excluded from latency percentiles.
 */
export function recordVideoCompletionMetric(
  jobId: string,
  tenantId: string,
  createdAt: number | null | undefined,
  completedAt: number,
): void {
  try {
    const knownDuration =
      typeof createdAt === 'number' && createdAt > 0 && completedAt > createdAt;
    const durationSeconds = knownDuration ? completedAt - createdAt : 0;

    const point: VideoJobMetricPoint = {
      outcome: 'completed',
      jobId,
      tenantId,
      durationSeconds,
      slow: durationSeconds > 0 && durationSeconds > RENDER_STAGE_THRESHOLD,
      timestamp: Date.now(),
    };
    writeVideoJobToWAE(getWAEBindingForMetrics(), point);
  } catch {
    // Never let telemetry break video completion.
  }
}
