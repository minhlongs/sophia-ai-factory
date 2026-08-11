/**
 * In-memory metrics ring buffer — per Worker isolate, best-effort.
 * Tracks request count, error count, and response durations per route.
 * snapshot() computes p50/p95/p99 percentiles from stored durations.
 * Ring buffer capped at MAX_DURATIONS per route to bound memory.
 *
 * Also exports to Workers Analytics Engine (WAE) and Sentry for persistent metrics.
 */

import type { AnalyticsEngineDataset } from '@cloudflare/workers-types';
import { writeToWAE, type SLOMetricPoint } from './wae-client';
import { emitSentryMetric, type SentryMetricConfig } from './sentry-metrics';

const MAX_DURATIONS = 1000;

// Emit to Sentry every N requests (to avoid rate limiting)
const SENTRY_EMIT_INTERVAL = 100;

interface RouteStats {
  count: number;
  errors: number;
  durations: number[];
  sentryEmitCounter: number;
}

// Isolate-scoped map — persists across requests within same Worker instance
const statsMap = new Map<string, RouteStats>();

// WAE binding (set at startup from env)
let waeBinding: AnalyticsEngineDataset | undefined;

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(p / 100 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/** Set WAE binding (called once at Worker startup from middleware/env) */
export function setWAEBinding(binding: AnalyticsEngineDataset | undefined): void {
  waeBinding = binding;
}

export function record(
  route: string,
  durationMs: number,
  isError: boolean,
  options?: { method?: string; status?: number }
): void {
  let s = statsMap.get(route);
  if (!s) {
    s = { count: 0, errors: 0, durations: [], sentryEmitCounter: 0 };
    statsMap.set(route, s);
  }
  s.count++;
  if (isError) s.errors++;
  s.durations.push(durationMs);
  if (s.durations.length > MAX_DURATIONS) {
    s.durations.shift();
  }

  // Export to Workers Analytics Engine (fire-and-forget)
  if (waeBinding) {
    const point: SLOMetricPoint = {
      route,
      method: options?.method || 'UNKNOWN',
      status: options?.status || (isError ? 500 : 200),
      durationMs,
      isError,
      timestamp: Date.now(),
      workerId: crypto.randomUUID?.() || Math.random().toString(36).slice(2),
    };
    writeToWAE(waeBinding, point);
  }

  // Periodically emit to Sentry for real-time alerting
  s.sentryEmitCounter++;
  if (s.sentryEmitCounter >= SENTRY_EMIT_INTERVAL) {
    s.sentryEmitCounter = 0;
    const sorted = [...s.durations].sort((a, b) => a - b);
    const metrics: SentryMetricConfig[] = [
      {
        name: 'latency.p95',
        value: percentile(sorted, 95),
        unit: 'millisecond',
        tags: { route },
      },
      {
        name: 'error.rate',
        value: s.errors / s.count,
        unit: 'ratio',
        tags: { route },
      },
    ];
    emitSentryMetrics(metrics);
  }
}

/** Batch emit helper for Sentry */
function emitSentryMetrics(configs: SentryMetricConfig[]): void {
  for (const config of configs) {
    emitSentryMetric(config);
  }
}

export function snapshot(): Array<{
  route: string;
  count: number;
  errors: number;
  p50: number;
  p95: number;
  p99: number;
}> {
  const result = [];
  for (const [route, s] of statsMap.entries()) {
    const sorted = [...s.durations].sort((a, b) => a - b);
    result.push({
      route,
      count: s.count,
      errors: s.errors,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
    });
  }
  return result;
}

/** Reset all stats (for testing). */
export function reset(): void {
  statsMap.clear();
}

/** Get stats for a specific route (for cron aggregation) */
export function getRouteStats(route: string): RouteStats | undefined {
  return statsMap.get(route);
}

/** Get all route stats (for cron aggregation) */
export function getAllRouteStats(): Map<string, RouteStats> {
  return new Map(statsMap);
}