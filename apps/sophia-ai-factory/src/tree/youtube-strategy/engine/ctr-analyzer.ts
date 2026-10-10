/**
 * Performance Metrics, Baseline & CTR/Delta Analysis
 *
 * Layer: tree/youtube-strategy/engine
 */

import type { PerformanceMetrics, PerformanceSnapshot } from './types';

/**
 * Capture performance data for a video into a normalized snapshot.
 */
export function normalizeMetrics(report: {
  analytics?: Record<string, unknown>;
  thumbnailMetrics?: Record<string, unknown>;
  performance?: Record<string, unknown>;
}): PerformanceMetrics {
  const analytics = report.analytics ?? {};
  const views = (analytics.views as Record<string, unknown>) ?? {};
  const watchTime = (analytics.watchTime as Record<string, unknown>) ?? {};
  const engagement = (analytics.engagement as Record<string, unknown>) ?? {};

  return {
    views: toNumber(views.totalViews),
    impressions: toNumber(views.totalImpressions ?? report.thumbnailMetrics?.impressions),
    ctr: toNumber(report.thumbnailMetrics?.clickThroughRate ?? views.averageCTR),
    retention: toNumber(watchTime.averageViewPercentage),
    averageViewDuration: toNumber(watchTime.averageViewDuration),
    watchMinutes: toNumber(watchTime.totalWatchTime),
    engagementRate: toNumber(engagement.engagementRate),
    performanceScore: toNumber(report.performance?.score),
  };
}

/**
 * Calculate baseline metrics from a list of prior snapshots.
 */
export function calculateBaseline(snapshots: readonly PerformanceSnapshot[]): Record<string, number> {
  const keys: (keyof PerformanceMetrics)[] = [
    'views',
    'impressions',
    'ctr',
    'retention',
    'averageViewDuration',
    'watchMinutes',
    'engagementRate',
    'performanceScore',
  ];
  return Object.fromEntries(
    keys.map((key) => [
      key,
      median(
        snapshots
          .map((s) => s.metrics[key])
          .filter((v): v is number => typeof v === 'number' && Number.isFinite(v)),
      ),
    ]),
  );
}

/**
 * Calculate percentage deltas between current metrics and baseline.
 */
export function calculateDeltas(
  metrics: PerformanceMetrics,
  baseline: Record<string, number>,
): Record<string, number | null> {
  return Object.fromEntries(
    Object.entries(metrics).map(([key, value]) => {
      const reference = toNumber(baseline[key]);
      return [
        key,
        reference > 0
          ? Number((((value - reference) / reference) * 100).toFixed(1))
          : null,
      ];
    }),
  );
}

/**
 * Determine confidence level based on impression and view counts.
 */
export function confidenceFor(metrics: PerformanceMetrics): 'high' | 'medium' | 'low' {
  if (metrics.impressions >= 1000 && metrics.views >= 100) return 'high';
  if (metrics.impressions >= 100 && metrics.views >= 20) return 'medium';
  return 'low';
}

export function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function average(values: number[]): number {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
}

export function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((item) => text(item)).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map((item) => text(item)).join(' ');
  return '';
}

export function wordCount(value: string): number {
  return String(value).trim().split(/\s+/).filter(Boolean).length;
}

export function slug(value: string): string {
  return String(value ?? 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'unknown';
}

export function readable(value: string): string {
  return String(value).replaceAll('_', ' ');
}

export function metric(value: number, metricName: string): string {
  return metricName === 'performanceScore' ? value.toFixed(0) : `${value.toFixed(1)}%`;
}
