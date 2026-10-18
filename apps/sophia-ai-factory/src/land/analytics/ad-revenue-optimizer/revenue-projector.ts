/**
 * Future Ad Revenue Projections & Channel Yield Ranking Helpers
 *
 * Layer: land/analytics/ad-revenue-optimizer
 * @module land/analytics/ad-revenue-optimizer/revenue-projector
 */

import type {
  DurationCategory,
  FormatYieldSummary,
  RevenueProjection,
} from './types';

export const OPTIMAL_DURATION_RANGES: Record<DurationCategory, { minSeconds: number; maxSeconds: number }> = {
  short: { minSeconds: 30, maxSeconds: 55 },
  mid: { minSeconds: 180, maxSeconds: 420 },
  long: { minSeconds: 485, maxSeconds: 900 },
};

export function selectTopFormat(
  formatBreakdown: Record<DurationCategory, FormatYieldSummary>,
): DurationCategory {
  let topFormat: DurationCategory = 'mid';
  let highestRpm = -1;
  for (const cat of ['short', 'mid', 'long'] as const) {
    if (formatBreakdown[cat].count > 0 && formatBreakdown[cat].avgRpm > highestRpm) {
      highestRpm = formatBreakdown[cat].avgRpm;
      topFormat = cat;
    }
  }
  return topFormat;
}

export function selectPeakHour(hourViews: Record<number, number>): number | null {
  let peakHour: number | null = null;
  let maxHourViews = -1;
  for (const [hourStr, views] of Object.entries(hourViews)) {
    if (views > maxHourViews) {
      maxHourViews = views;
      peakHour = Number(hourStr);
    }
  }
  return peakHour;
}

export function buildActionableInsights(
  topFormat: DurationCategory,
  formatBreakdown: Record<DurationCategory, FormatYieldSummary>,
  peakHour: number | null,
  avgRpm: number,
): string[] {
  const insights: string[] = [
    `Highest yield format: ${topFormat.toUpperCase()} with $${formatBreakdown[topFormat].avgRpm} RPM`,
  ];
  if (peakHour !== null) {
    insights.push(`Peak audience activity occurs around ${peakHour}:00 UTC — schedule uploads 2h prior`);
  }
  if (formatBreakdown.long.count === 0 && avgRpm < 2.0) {
    insights.push('Consider producing 8m+ deep-dive videos to capture mid-roll ad inventory');
  }
  return insights;
}

export function projectAdRevenue(
  targetViews: number,
  targetDurationSeconds: number,
  baselineRpm: number,
): RevenueProjection {
  const views = Math.max(0, targetViews);
  const duration = Math.max(1, targetDurationSeconds);
  const baseRpm = Math.max(0.1, baselineRpm);

  let multiplier = 1.0;
  if (duration > 480) multiplier = 1.6;
  else if (duration <= 60) multiplier = 0.4;

  const effectiveRpm = baseRpm * multiplier;
  const estimatedRevenue = Math.round((views / 1000) * effectiveRpm * 100) / 100;
  const minRevenue = Math.round(estimatedRevenue * 0.75 * 100) / 100;
  const maxRevenue = Math.round(estimatedRevenue * 1.35 * 100) / 100;

  return {
    estimatedRevenueUsd: estimatedRevenue,
    confidenceMinUsd: minRevenue,
    confidenceMaxUsd: maxRevenue,
  };
}
