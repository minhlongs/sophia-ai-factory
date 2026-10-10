/**
 * Time-series calculation and rollup utilities for Executive BI.
 *
 * Layer: tree/bi/aggregator (Pure domain logic)
 */

import type { DateRange, ExecutiveBIMetricsSummary } from './types';

/**
 * Creates an empty, zero-initialized ExecutiveBIMetricsSummary.
 */
export function createEmptyBIMetricsSummary(
  orgId: string,
  dateRange: DateRange,
): ExecutiveBIMetricsSummary {
  return {
    orgId,
    periodStart: dateRange?.start ?? 0,
    periodEnd: dateRange?.end ?? 0,
    mrrCents: 0,
    throughputCount: 0,
    viralScore: 0,
    affiliateRevenueCents: 0,
    marketingSpendCents: 0,
    roiRatio: 0,
  };
}

/**
 * Computes ROI ratio with zero-division protection.
 * - When spend > 0: returns (revenue / spend) rounded to 2 decimal places.
 * - When spend == 0 and revenue > 0: returns safe maximum multiplier 99.0x.
 * - When spend == 0 and revenue == 0: returns 0.0x.
 */
export function calculateRoiRatio(
  affiliateRevenueCents: number,
  marketingSpendCents: number,
): number {
  if (marketingSpendCents > 0) {
    return Number((affiliateRevenueCents / marketingSpendCents).toFixed(2));
  }
  if (affiliateRevenueCents > 0) {
    return 99.0;
  }
  return 0;
}

/**
 * Computes arithmetic mean of viral scores rounded to 2 decimal places.
 */
export function calculateAverageViralScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((acc, score) => acc + score, 0);
  return Number((sum / scores.length).toFixed(2));
}

/**
 * Validates date range integrity.
 */
export function isValidDateRange(range: DateRange): boolean {
  return (
    typeof range === 'object' &&
    range !== null &&
    typeof range.start === 'number' &&
    typeof range.end === 'number' &&
    Number.isFinite(range.start) &&
    Number.isFinite(range.end) &&
    range.start <= range.end
  );
}
