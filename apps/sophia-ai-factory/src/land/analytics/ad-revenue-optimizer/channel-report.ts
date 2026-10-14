/**
 * Channel-Level Ad Optimization Report & Future Revenue Projections
 *
 * Layer: land/analytics/ad-revenue-optimizer
 */

import type {
  ChannelAdOptimizationReport,
  DurationCategory,
  FormatYieldSummary,
  RevenueProjection,
  VideoAdMetrics,
} from './types';
import { calculateRpm, classifyDuration } from './video-yield';

export function generateChannelOptimizationReport(
  videos: readonly VideoAdMetrics[],
): ChannelAdOptimizationReport {
  if (videos.length === 0) {
    const emptyFormat = (): FormatYieldSummary => ({ count: 0, views: 0, revenueUsd: 0, avgRpm: 0 });
    return {
      totalViews: 0,
      totalRevenueUsd: 0,
      averageRpm: 0,
      topPerformingFormat: 'mid',
      optimalDurationRange: { minSeconds: 60, maxSeconds: 480 },
      peakPublishHourUtc: null,
      monetizationHealthScore: 0,
      formatBreakdown: { short: emptyFormat(), mid: emptyFormat(), long: emptyFormat() },
      actionableInsights: ['No video metrics available. Publish videos to start tracking ad yields.'],
    };
  }

  let totalViews = 0;
  let totalRevenue = 0;
  const hourViews: Record<number, number> = {};

  const breakdown = {
    short: { count: 0, views: 0, revenueUsd: 0 },
    mid: { count: 0, views: 0, revenueUsd: 0 },
    long: { count: 0, views: 0, revenueUsd: 0 },
  };

  for (const v of videos) {
    const views = Math.max(0, v.views);
    const rev = Math.max(0, v.estimatedRevenueUsd);
    const cat = classifyDuration(v.durationSeconds);

    totalViews += views;
    totalRevenue += rev;
    breakdown[cat].count += 1;
    breakdown[cat].views += views;
    breakdown[cat].revenueUsd += rev;

    if (v.publishHourUtc !== undefined && v.publishHourUtc >= 0 && v.publishHourUtc < 24) {
      hourViews[v.publishHourUtc] = (hourViews[v.publishHourUtc] ?? 0) + views;
    }
  }

  const formatSummary = (cat: DurationCategory): FormatYieldSummary => {
    const data = breakdown[cat];
    return {
      count: data.count,
      views: data.views,
      revenueUsd: Math.round(data.revenueUsd * 100) / 100,
      avgRpm: calculateRpm(data.revenueUsd, data.views),
    };
  };

  const formatBreakdown = {
    short: formatSummary('short'),
    mid: formatSummary('mid'),
    long: formatSummary('long'),
  };

  let topFormat: DurationCategory = 'mid';
  let highestRpm = -1;
  for (const cat of ['short', 'mid', 'long'] as const) {
    if (formatBreakdown[cat].count > 0 && formatBreakdown[cat].avgRpm > highestRpm) {
      highestRpm = formatBreakdown[cat].avgRpm;
      topFormat = cat;
    }
  }

  let peakHour: number | null = null;
  let maxHourViews = -1;
  for (const [hourStr, views] of Object.entries(hourViews)) {
    if (views > maxHourViews) {
      maxHourViews = views;
      peakHour = Number(hourStr);
    }
  }

  const optimalRanges: Record<DurationCategory, { minSeconds: number; maxSeconds: number }> = {
    short: { minSeconds: 30, maxSeconds: 55 },
    mid: { minSeconds: 180, maxSeconds: 420 },
    long: { minSeconds: 485, maxSeconds: 900 },
  };

  const avgRpm = calculateRpm(totalRevenue, totalViews);
  const healthScore = Math.min(100, Math.max(10, Math.round(avgRpm * 25 + (totalViews > 10000 ? 25 : 10))));

  const actionableInsights: string[] = [];
  actionableInsights.push(`Highest yield format: ${topFormat.toUpperCase()} with $${formatBreakdown[topFormat].avgRpm} RPM`);
  if (peakHour !== null) {
    actionableInsights.push(`Peak audience activity occurs around ${peakHour}:00 UTC — schedule uploads 2h prior`);
  }
  if (formatBreakdown.long.count === 0 && avgRpm < 2.0) {
    actionableInsights.push('Consider producing 8m+ deep-dive videos to capture mid-roll ad inventory');
  }

  return {
    totalViews,
    totalRevenueUsd: Math.round(totalRevenue * 100) / 100,
    averageRpm: avgRpm,
    topPerformingFormat: topFormat,
    optimalDurationRange: optimalRanges[topFormat],
    peakPublishHourUtc: peakHour,
    monetizationHealthScore: healthScore,
    formatBreakdown,
    actionableInsights,
  };
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
