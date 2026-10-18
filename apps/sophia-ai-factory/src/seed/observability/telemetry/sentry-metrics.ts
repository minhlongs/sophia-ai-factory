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

export {
  type SLOAggregateMetrics,
  emitSLOAggregateMetrics,
  type BurnRateAlert,
  emitBurnRateAlert,
} from './sentry-slo-metrics';