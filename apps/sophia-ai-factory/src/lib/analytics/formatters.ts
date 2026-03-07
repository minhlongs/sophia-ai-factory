/**
 * Analytics Data Formatters
 *
 * Utility functions for formatting analytics data
 */

import type {
  UsageMetrics,
  TimeSeriesPoint,
  ServiceBreakdown,
  RevenueMetrics,
  RevenueTrend,
  LicenseMetrics,
  LicenseUtilization,
} from './types';

/**
 * Format large numbers with K/M/B suffixes
 */
export function formatCompactNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1) + 'B';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Format currency USD
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format percentage with fixed decimals
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format timestamp to readable date
 */
export function formatDate(timestamp: number, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    ...options,
  }).format(new Date(timestamp * 1000));
}

/**
 * Format timestamp to date string (YYYY-MM-DD)
 */
export function formatDateKey(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().split('T')[0];
}

/**
 * Fill missing time points in series with zeros
 *
 * @param timeSeries - Existing time series data
 * @param startTimestamp - Start of range
 * @param endTimestamp - End of range
 * @param granularity - 'hour' | 'day'
 */
export function fillTimeSeriesGaps(
  timeSeries: TimeSeriesPoint[],
  startTimestamp: number,
  endTimestamp: number,
  granularity: 'hour' | 'day' = 'hour'
): TimeSeriesPoint[] {
  if (timeSeries.length === 0) return [];

  const interval = granularity === 'hour' ? 3600 : 86400;
  const filled: TimeSeriesPoint[] = [];
  const existingMap = new Map(timeSeries.map(p => [p.timestamp, p]));

  for (let ts = startTimestamp; ts <= endTimestamp; ts += interval) {
    const existing = existingMap.get(ts);
    filled.push(existing || {
      timestamp: ts,
      requests: 0,
      credits: 0,
      tokens: 0,
      errors: 0,
    });
  }

  return filled;
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

/**
 * Group time series by date for daily aggregation
 */
export function groupTimeSeriesByDate(timeSeries: TimeSeriesPoint[]): Record<string, TimeSeriesPoint> {
  return timeSeries.reduce((acc, point) => {
    const dateKey = formatDateKey(point.timestamp);
    const existing = acc[dateKey] || {
      timestamp: point.timestamp,
      requests: 0,
      credits: 0,
      tokens: 0,
      errors: 0,
    };

    existing.requests += point.requests;
    existing.credits += point.credits;
    existing.tokens += point.tokens;
    existing.errors += point.errors;

    acc[dateKey] = existing;
    return acc;
  }, {} as Record<string, TimeSeriesPoint>);
}

/**
 * Calculate moving average for time series
 */
export function calculateMovingAverage(
  timeSeries: TimeSeriesPoint[],
  window: number = 7
): Array<{ timestamp: number; value: number }> {
  if (timeSeries.length < window) return [];

  const result: Array<{ timestamp: number; value: number }> = [];

  for (let i = window - 1; i < timeSeries.length; i++) {
    const sum = timeSeries.slice(i - window + 1, i + 1)
      .reduce((acc, p) => acc + p.credits, 0);
    result.push({
      timestamp: timeSeries[i].timestamp,
      value: sum / window,
    });
  }

  return result;
}

/**
 * Sort service breakdown by requests or credits
 */
export function sortServiceBreakdown(
  breakdown: ServiceBreakdown[],
  sortBy: 'requests' | 'credits' = 'requests'
): ServiceBreakdown[] {
  return [...breakdown].sort((a, b) => b[sortBy] - a[sortBy]);
}

/**
 * Filter utilization by threshold
 */
export function filterUtilizationByThreshold(
  utilization: LicenseUtilization[],
  minPercentage: number = 0,
  maxPercentage: number = 100
): LicenseUtilization[] {
  return utilization.filter(
    u => u.percentage >= minPercentage && u.percentage <= maxPercentage
  );
}

/**
 * Get utilization statistics
 */
export function getUtilizationStats(utilization: LicenseUtilization[]): {
  average: number;
  median: number;
  high: number;
  low: number;
} {
  if (utilization.length === 0) {
    return { average: 0, median: 0, high: 0, low: 0 };
  }

  const sorted = utilization.map(u => u.percentage).sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);

  const medianIndex = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[medianIndex - 1] + sorted[medianIndex]) / 2
    : sorted[medianIndex];

  return {
    average: Math.round((sum / sorted.length) * 100) / 100,
    median: Math.round(median * 100) / 100,
    high: sorted[sorted.length - 1],
    low: sorted[0],
  };
}

/**
 * Prepare chart data for Recharts
 */
export function prepareChartData(metrics: UsageMetrics): Array<{
  name: string;
  timestamp: number;
  requests: number;
  credits: number;
  tokens: number;
  errors: number;
}> {
  return metrics.timeSeries.map(point => ({
    name: formatDate(point.timestamp, { hour: 'numeric', minute: '2-digit' }),
    timestamp: point.timestamp,
    requests: point.requests,
    credits: point.credits,
    tokens: point.tokens,
    errors: point.errors,
  }));
}

/**
 * Prepare revenue chart data
 */
export function prepareRevenueChartData(metrics: RevenueMetrics): Array<{
  name: string;
  date: string;
  revenue: number;
}> {
  return metrics.trend.map(point => ({
    name: point.date,
    date: point.date,
    revenue: Math.round(point.revenue * 100) / 100,
  }));
}
