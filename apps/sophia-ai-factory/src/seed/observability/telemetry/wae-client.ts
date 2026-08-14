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