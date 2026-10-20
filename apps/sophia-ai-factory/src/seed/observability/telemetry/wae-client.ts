/**
 * Workers Analytics Engine (WAE) Client
 * High-cardinality metrics export for Cloudflare Workers
 * Dataset: 'sophia_slo_metrics'
 */

import type { AnalyticsEngineDataset } from '@cloudflare/workers-types';

export interface SLOMetricPoint {
  route: string;
  method: string;
  status: number;
  durationMs: number;
  isError: boolean;
  timestamp: number;
  workerId?: string;
}

/**
 * One terminal video job outcome.
 *
 * Kept separate from SLOMetricPoint because an API request's `status` is an HTTP
 * code while a video job's outcome is a terminal state; folding them into one
 * point would make `status` mean two different things in the same dataset.
 */
export interface VideoJobMetricPoint {
  /** 'completed' | 'failed_permanent' — the terminal state the job reached. */
  outcome: string;
  /** Video job id. */
  jobId: string;
  /** Tenant that owns the job. */
  tenantId: string;
  /** Accepted-to-first-playable seconds; 0 when unknown. */
  durationSeconds: number;
  /** True when the job exceeded the render-stage budget. */
  slow: boolean;
  timestamp: number;
}

const _DATASET_NAME = 'sophia_slo_metrics';

/**
 * Write a metric point to Workers Analytics Engine
 * Uses fire-and-forget; WAE handles batching and sampling
 */
export function writeToWAE(
  binding: AnalyticsEngineDataset | undefined,
  point: SLOMetricPoint
): void {
  if (!binding) {
    // WAE binding not available (local dev) — skip silently
    return;
  }

  try {
    const indexes = [
      point.route,                    // index 0: route pattern
      point.method,                   // index 1: HTTP method
      String(point.status),           // index 2: status code
      point.isError ? 'error' : 'ok', // index 3: error class
    ];

    const blobs = [
      point.workerId || 'unknown',    // blob 0: worker instance ID
    ];

    const doubles = [
      point.durationMs,               // double 0: latency in ms
      point.timestamp,                // double 1: Unix timestamp
      point.isError ? 1 : 0,          // double 2: error flag (for rate calc)
    ];

    binding.writeDataPoint({ indexes, blobs, doubles });
  } catch (e) {
    // Never throw — metrics loss is acceptable, request failure is not
    console.debug('[WAE] write failed', e);
  }
}

/**
 * Write one terminal video job outcome to Analytics Engine.
 *
 * Indexes carry the low-cardinality dimensions an SLO query groups by. `jobId`
 * is a blob rather than an index because it is high-cardinality and only ever
 * needed for drilling into a single job, never for aggregation.
 */
export function writeVideoJobToWAE(
  binding: AnalyticsEngineDataset | undefined,
  point: VideoJobMetricPoint
): void {
  if (!binding) {
    // WAE binding not available (local dev) — skip silently
    return;
  }

  try {
    binding.writeDataPoint({
      indexes: [
        point.outcome,                    // index 0: terminal outcome
        point.slow ? 'over-budget' : 'within-budget', // index 1: budget class
      ],
      blobs: [point.jobId, point.tenantId],
      doubles: [
        point.durationSeconds,            // double 0: seconds to first playable
        point.timestamp,                  // double 1: Unix timestamp
      ],
    });
  } catch {
    // Never throw — metrics loss is acceptable, job completion is not.
  }
}

/**
 * Batch write multiple points (for cron aggregation jobs)
 */
export function writeBatchToWAE(
  binding: AnalyticsEngineDataset | undefined,
  points: SLOMetricPoint[]
): void {
  if (!binding || points.length === 0) return;

  try {
    for (const point of points) {
      writeToWAE(binding, point);
    }
  } catch (e) {
    console.debug('[WAE] batch write failed', e);
  }
}

/**
 * Get WAE binding from Cloudflare env
 * Usage in middleware: env.WAE
 */
export function getWAEBinding(env: { WAE?: AnalyticsEngineDataset }): AnalyticsEngineDataset | undefined {
  return env.WAE;
}

/**
 * SLO metric names for WAE queries
 */
export const WAE_SLO_METRICS = {
  availability: 'sophia_availability',
  apiLatencyP95: 'sophia_api_latency_p95',
  healthLatencyP95: 'sophia_health_latency_p95',
  webhookDeliveryP95: 'sophia_webhook_delivery_p95',
  errorRate: 'sophia_error_rate',
} as const;