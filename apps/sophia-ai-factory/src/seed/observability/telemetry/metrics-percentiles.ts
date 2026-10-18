/**
 * Percentile calculation and Sentry sampling helpers for isolate route metrics.
 *
 * Layer: seed/observability/telemetry
 *
 * @module seed/observability/telemetry/metrics-percentiles
 */

import { emitSentryMetric, type SentryMetricConfig } from './sentry-metrics';

export interface RouteStats {
  count: number;
  errors: number;
  durations: number[];
  sentryEmitCounter: number;
}

export function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/** Emit latency.p95 and error.rate to Sentry for a route stats entry */
export function emitRouteSentrySample(route: string, stats: RouteStats): void {
  const sorted = [...stats.durations].sort((a, b) => a - b);
  const metrics: SentryMetricConfig[] = [
    {
      name: 'latency.p95',
      value: percentile(sorted, 95),
      unit: 'millisecond',
      tags: { route },
    },
    {
      name: 'error.rate',
      value: stats.errors / stats.count,
      unit: 'ratio',
      tags: { route },
    },
  ];
  for (const config of metrics) {
    emitSentryMetric(config);
  }
}
