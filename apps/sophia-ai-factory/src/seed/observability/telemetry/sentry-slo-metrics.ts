/**
 * Sentry SLO Aggregate & Burn-Rate Alert Metric Emitters
 *
 * Layer: seed/observability/telemetry
 *
 * @module seed/observability/telemetry/sentry-slo-metrics
 */

import { emitSentryMetrics } from './sentry-metrics';

/**
 * Emit SLO metrics from aggregated data
 * Called by monthly cron or real-time aggregation
 */
export interface SLOAggregateMetrics {
  route: string;
  period: string; // '1m', '5m', '1h', '1d'
  totalRequests: number;
  errorCount: number;
  p50: number;
  p95: number;
  p99: number;
  availability: number; // 0-1
}

export function emitSLOAggregateMetrics(agg: SLOAggregateMetrics): void {
  const attributes = { route: agg.route, period: agg.period };

  emitSentryMetrics([
    {
      name: 'requests.total',
      value: agg.totalRequests,
      unit: 'count',
      tags: attributes,
    },
    {
      name: 'requests.errors',
      value: agg.errorCount,
      unit: 'count',
      tags: attributes,
    },
    {
      name: 'latency.p50',
      value: agg.p50,
      unit: 'millisecond',
      tags: attributes,
    },
    {
      name: 'latency.p95',
      value: agg.p95,
      unit: 'millisecond',
      tags: attributes,
    },
    {
      name: 'latency.p99',
      value: agg.p99,
      unit: 'millisecond',
      tags: attributes,
    },
    {
      name: 'availability',
      value: agg.availability,
      unit: 'ratio',
      tags: attributes,
    },
  ]);
}

/**
 * Emit burn-rate alert metrics
 */
export interface BurnRateAlert {
  sloName: string;
  burnRate: number;
  alertLevel: 'info' | 'warning' | 'critical' | 'emergency';
  period: string;
}

export function emitBurnRateAlert(alert: BurnRateAlert): void {
  emitSentryMetrics([
    {
      name: 'burn_rate',
      value: alert.burnRate,
      unit: 'ratio',
      tags: { slo: alert.sloName, level: alert.alertLevel, period: alert.period },
    },
    {
      name: 'alert.fired',
      value: 1,
      unit: 'count',
      tags: { slo: alert.sloName, level: alert.alertLevel, period: alert.period },
    },
  ]);
}
