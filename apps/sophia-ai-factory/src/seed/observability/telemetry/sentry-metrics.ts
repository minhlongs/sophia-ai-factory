/**
 * Sentry Custom Metrics Client
 * Exports SLO metrics to Sentry for real-time alerting
 * Uses Sentry's Metrics API (requires Sentry SDK v7.70+)
 */

import * as Sentry from '@sentry/nextjs';

export interface SentryMetricConfig {
  name: string;
  value: number;
  unit?: 'millisecond' | 'percent' | 'count' | 'ratio';
  tags?: Record<string, string>;
}

const METRIC_PREFIX = 'sophia.slo';

/**
 * Emit a custom metric to Sentry
 * Requires SENTRY_DSN and metrics enabled in sentry.client.config.ts
 */
export function emitSentryMetric(config: SentryMetricConfig): void {
  if (!Sentry.metrics || typeof Sentry.metrics.count !== 'function') {
    // Sentry metrics not available — skip silently
    return;
  }

  try {
    const fullName = `${METRIC_PREFIX}.${config.name}`;
    const attributes = {
      environment: process.env.NODE_ENV || 'development',
      ...config.tags,
    };

    // Use distribution for latency (p50/p95/p99), gauge for rates, count for counters
    if (config.unit === 'millisecond') {
      Sentry.metrics.distribution(fullName, config.value, { attributes, unit: config.unit });
    } else if (config.unit === 'percent' || config.unit === 'ratio') {
      Sentry.metrics.gauge(fullName, config.value, { attributes, unit: config.unit });
    } else {
      Sentry.metrics.count(fullName, config.value, { attributes, unit: config.unit });
    }
  } catch (e) {
    // Never throw — metrics loss acceptable
    console.debug('[Sentry Metrics] emit failed', e);
  }
}

/**
 * Emit batch of metrics
 */
export function emitSentryMetrics(configs: SentryMetricConfig[]): void {
  for (const config of configs) {
    emitSentryMetric(config);
  }
}

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