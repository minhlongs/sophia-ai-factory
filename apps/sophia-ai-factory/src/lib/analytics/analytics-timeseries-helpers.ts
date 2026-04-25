/**
 * Analytics time-series helpers
 *
 * Date formatting, gap filling, grouping, and moving averages.
 * Must NOT import from formatters.ts (prevents circular imports).
 */

import type { TimeSeriesPoint } from './types'

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
  }).format(new Date(timestamp * 1000))
}

/**
 * Format timestamp to date string (YYYY-MM-DD)
 */
export function formatDateKey(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().split('T')[0]
}

/**
 * Fill missing time points in series with zeros
 */
export function fillTimeSeriesGaps(
  timeSeries: TimeSeriesPoint[],
  startTimestamp: number,
  endTimestamp: number,
  granularity: 'hour' | 'day' = 'hour'
): TimeSeriesPoint[] {
  if (timeSeries.length === 0) return []

  const interval = granularity === 'hour' ? 3600 : 86400
  const filled: TimeSeriesPoint[] = []
  const existingMap = new Map(timeSeries.map(p => [p.timestamp, p]))

  for (let ts = startTimestamp; ts <= endTimestamp; ts += interval) {
    const existing = existingMap.get(ts)
    filled.push(existing || { timestamp: ts, requests: 0, credits: 0, tokens: 0, errors: 0 })
  }

  return filled
}

/**
 * Group time series by date for daily aggregation
 */
export function groupTimeSeriesByDate(timeSeries: TimeSeriesPoint[]): Record<string, TimeSeriesPoint> {
  return timeSeries.reduce((acc, point) => {
    const dateKey = formatDateKey(point.timestamp)
    const existing = acc[dateKey] || { timestamp: point.timestamp, requests: 0, credits: 0, tokens: 0, errors: 0 }

    existing.requests += point.requests
    existing.credits += point.credits
    existing.tokens += point.tokens
    existing.errors += point.errors

    acc[dateKey] = existing
    return acc
  }, {} as Record<string, TimeSeriesPoint>)
}

/**
 * Calculate moving average for time series
 */
export function calculateMovingAverage(
  timeSeries: TimeSeriesPoint[],
  window: number = 7
): Array<{ timestamp: number; value: number }> {
  if (timeSeries.length < window) return []

  const result: Array<{ timestamp: number; value: number }> = []

  for (let i = window - 1; i < timeSeries.length; i++) {
    const sum = timeSeries.slice(i - window + 1, i + 1).reduce((acc, p) => acc + p.credits, 0)
    result.push({ timestamp: timeSeries[i].timestamp, value: sum / window })
  }

  return result
}
