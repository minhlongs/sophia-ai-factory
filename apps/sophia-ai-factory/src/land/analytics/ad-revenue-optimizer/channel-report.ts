/**
 * Channel-Level Ad Optimization Report & Future Revenue Projections
 *
 * Layer: land/analytics/ad-revenue-optimizer
 */

import type {
  ChannelAdOptimizationReport,
  DurationCategory,
  FormatYieldSummary,
  VideoAdMetrics,
} from './types';
import { calculateRpm, classifyDuration } from './video-yield';
import {
  OPTIMAL_DURATION_RANGES,
  selectTopFormat,
  selectPeakHour,
  buildActionableInsights,
  projectAdRevenue,
} from './revenue-projector';

export { projectAdRevenue };

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

  const formatSummary = (cat: DurationCategory): FormatYieldSummary => ({
    count: breakdown[cat].count,
    views: breakdown[cat].views,
    revenueUsd: Math.round(breakdown[cat].revenueUsd * 100) / 100,
    avgRpm: calculateRpm(breakdown[cat].revenueUsd, breakdown[cat].views),
  });

  const formatBreakdown = {
    short: formatSummary('short'),
    mid: formatSummary('mid'),
    long: formatSummary('long'),
  };
  const topFormat = selectTopFormat(formatBreakdown);
  const peakHour = selectPeakHour(hourViews);
  const avgRpm = calculateRpm(totalRevenue, totalViews);
  const healthScore = Math.min(100, Math.max(10, Math.round(avgRpm * 25 + (totalViews > 10000 ? 25 : 10))));

  return {
    totalViews,
    totalRevenueUsd: Math.round(totalRevenue * 100) / 100,
    averageRpm: avgRpm,
    topPerformingFormat: topFormat,
    optimalDurationRange: OPTIMAL_DURATION_RANGES[topFormat],
    peakPublishHourUtc: peakHour,
    monetizationHealthScore: healthScore,
    formatBreakdown,
    actionableInsights: buildActionableInsights(topFormat, formatBreakdown, peakHour, avgRpm),
  };
}
