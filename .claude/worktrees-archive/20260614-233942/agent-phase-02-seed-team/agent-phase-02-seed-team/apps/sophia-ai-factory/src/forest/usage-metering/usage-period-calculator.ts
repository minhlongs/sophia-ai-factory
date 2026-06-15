/**
 * Usage Period Calculator — period resolution and per-license summary.
 * Do not import from export.ts here.
 *
 * @module usage-metering/usage-period-calculator
 */

import type { UsageSummary } from './types';
import type { HourlySummary, DailySummary } from './types';
import { exportUsage } from './export';

/**
 * Resolve named period string to Unix timestamps.
 * Returns { startTimestamp, endTimestamp } in seconds.
 */
export function resolvePeriodTimestamps(period: string): { startTimestamp: number; endTimestamp: number } {
  const now = Math.floor(Date.now() / 1000);
  const date = new Date();

  switch (period) {
    case 'current_month':
      return {
        startTimestamp: Math.floor(new Date(date.getFullYear(), date.getMonth(), 1).getTime() / 1000),
        endTimestamp: now,
      };
    case 'last_month': {
      date.setMonth(date.getMonth() - 1);
      return {
        startTimestamp: Math.floor(new Date(date.getFullYear(), date.getMonth(), 1).getTime() / 1000),
        endTimestamp: Math.floor(new Date(date.getFullYear(), date.getMonth() + 1, 0).getTime() / 1000),
      };
    }
    case 'last_7_days':
      return { startTimestamp: now - 7 * 86400, endTimestamp: now };
    case 'last_30_days':
    default:
      return { startTimestamp: now - 30 * 86400, endTimestamp: now };
  }
}

/**
 * Get usage summary for a specific license over a named period.
 *
 * @param licenseNonce - License nonce
 * @param period - Period string (current_month, last_month, last_7_days, last_30_days)
 */
export async function getUsageSummaryForPeriod(
  licenseNonce: string,
  period: string = 'current_month'
): Promise<{
  summary: UsageSummary[];
  totalCredits: number;
  startTimestamp: number;
  endTimestamp: number;
  hourly?: HourlySummary[];
  daily?: DailySummary[];
}> {
  const { startTimestamp, endTimestamp } = resolvePeriodTimestamps(period);

  const { summary, aggregated } = await exportUsage({
    licenseNonce,
    startTimestamp,
    endTimestamp,
    format: 'json',
  });

  const totalCredits = aggregated?.totalCredits || summary.reduce((sum, s) => sum + s.total_credits, 0);

  return {
    summary,
    totalCredits,
    startTimestamp,
    endTimestamp,
    hourly: aggregated?.hourly,
    daily: aggregated?.daily,
  };
}
