/**
 * Analytics Data Formatters — barrel re-export + chart/utilization helpers
 *
 * Consumers can import any formatter from this single entry point.
 */

import type { UsageMetrics, ServiceBreakdown, RevenueMetrics, LicenseUtilization } from './types'
import { formatDate } from './analytics-timeseries-helpers'

// ---- Re-exports ----
export {
  formatCompactNumber,
  formatCurrency,
  formatPercentage,
  calculatePercentChange,
} from '@/seed/utils/analytics-number-formatters'

export {
  formatDate,
  formatDateKey,
  fillTimeSeriesGaps,
  groupTimeSeriesByDate,
  calculateMovingAverage,
} from './analytics-timeseries-helpers'

// ---- Chart / utilization helpers (depend on sub-modules above) ----

/**
 * Sort service breakdown by requests or credits
 */
export function sortServiceBreakdown(
  breakdown: ServiceBreakdown[],
  sortBy: 'requests' | 'credits' = 'requests'
): ServiceBreakdown[] {
  return [...breakdown].sort((a, b) => b[sortBy] - a[sortBy])
}

/**
 * Filter utilization by threshold
 */
export function filterUtilizationByThreshold(
  utilization: LicenseUtilization[],
  minPercentage: number = 0,
  maxPercentage: number = 100
): LicenseUtilization[] {
  return utilization.filter(u => u.percentage >= minPercentage && u.percentage <= maxPercentage)
}

/**
 * Get utilization statistics
 */
export function getUtilizationStats(utilization: LicenseUtilization[]): {
  average: number
  median: number
  high: number
  low: number
} {
  if (utilization.length === 0) return { average: 0, median: 0, high: 0, low: 0 }

  const sorted = utilization.map(u => u.percentage).sort((a, b) => a - b)
  const sum = sorted.reduce((a, b) => a + b, 0)
  const medianIndex = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0
      ? (sorted[medianIndex - 1] + sorted[medianIndex]) / 2
      : sorted[medianIndex]

  return {
    average: Math.round((sum / sorted.length) * 100) / 100,
    median: Math.round(median * 100) / 100,
    high: sorted[sorted.length - 1],
    low: sorted[0],
  }
}

/**
 * Prepare chart data for Recharts
 */
export function prepareChartData(metrics: UsageMetrics): Array<{
  name: string
  timestamp: number
  requests: number
  credits: number
  tokens: number
  errors: number
}> {
  return metrics.timeSeries.map(point => ({
    name: formatDate(point.timestamp, { hour: 'numeric', minute: '2-digit' }),
    timestamp: point.timestamp,
    requests: point.requests,
    credits: point.credits,
    tokens: point.tokens,
    errors: point.errors,
  }))
}

/**
 * Prepare revenue chart data
 */
export function prepareRevenueChartData(metrics: RevenueMetrics): Array<{
  name: string
  date: string
  revenue: number
}> {
  return metrics.trend.map(point => ({
    name: point.date,
    date: point.date,
    revenue: Math.round(point.revenue * 100) / 100,
  }))
}
