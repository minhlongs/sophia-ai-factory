/**
 * Ad Revenue Optimizer — Deterministic RPM/CPM modeling and duration yield analysis.
 * Provides content creators and CEOs with video yield projections and optimal publishing cadence.
 *
 * Layer: land (pure business analytics workflow)
 *
 * @module land/analytics/ad-revenue-optimizer
 */

export interface VideoAdMetrics {
  readonly videoId: string;
  readonly views: number;
  readonly watchTimeMinutes: number;
  readonly estimatedRevenueUsd: number;
  readonly durationSeconds: number;
  readonly publishHourUtc?: number;
}

export type DurationCategory = 'short' | 'mid' | 'long';

export interface VideoYieldAnalysis {
  readonly videoId: string;
  readonly rpm: number;
  readonly cpm: number;
  readonly revenuePerMinuteWatched: number;
  readonly durationCategory: DurationCategory;
  readonly optimizationScore: number;
  readonly recommendations: readonly string[];
}

export interface FormatYieldSummary {
  readonly count: number;
  readonly views: number;
  readonly revenueUsd: number;
  readonly avgRpm: number;
}

export interface ChannelAdOptimizationReport {
  readonly totalViews: number;
  readonly totalRevenueUsd: number;
  readonly averageRpm: number;
  readonly topPerformingFormat: DurationCategory;
  readonly optimalDurationRange: { readonly minSeconds: number; readonly maxSeconds: number };
  readonly peakPublishHourUtc: number | null;
  readonly monetizationHealthScore: number;
  readonly formatBreakdown: Record<DurationCategory, FormatYieldSummary>;
  readonly actionableInsights: readonly string[];
}

export interface RevenueProjection {
  readonly estimatedRevenueUsd: number;
  readonly confidenceMinUsd: number;
  readonly confidenceMaxUsd: number;
}

export function calculateRpm(revenueUsd: number, views: number): number {
  if (views <= 0 || revenueUsd <= 0) return 0;
  return Math.round((revenueUsd / views) * 1000 * 100) / 100;
}

export function classifyDuration(durationSeconds: number): DurationCategory {
  if (durationSeconds <= 60) return 'short';
  if (durationSeconds <= 480) return 'mid';
  return 'long';
}

export function analyzeVideoYield(metric: VideoAdMetrics): VideoYieldAnalysis {
  const views = Math.max(0, metric.views);
  const revenue = Math.max(0, metric.estimatedRevenueUsd);
  const watchTime = Math.max(0, metric.watchTimeMinutes);
  const duration = Math.max(1, metric.durationSeconds);
  const durationCat = classifyDuration(duration);

  const rpm = calculateRpm(revenue, views);
  const cpm = Math.round(rpm * 1.4 * 100) / 100;
  const revPerMin = watchTime > 0 ? Math.round((revenue / watchTime) * 10000) / 10000 : 0;

  const recommendations: string[] = [];
  let score = 50;

  if (rpm >= 3.0) score += 30;
  else if (rpm >= 1.5) score += 15;
  else if (views > 1000) recommendations.push('Low RPM: test higher-intent topics or mid-roll placements');

  if (durationCat === 'short' && duration > 50) {
    recommendations.push('Shorts pacing: consider trimming to 30-45s to maximize loop completion');
  } else if (durationCat === 'mid' && duration >= 450) {
    recommendations.push('Approaching 8min threshold: extend past 480s to enable mid-roll ad slots');
    score += 10;
  } else if (durationCat === 'long') {
    score += 15;
  }

  const finalScore = Math.min(100, Math.max(0, score));

  return {
    videoId: metric.videoId,
    rpm,
    cpm,
    revenuePerMinuteWatched: revPerMin,
    durationCategory: durationCat,
    optimizationScore: finalScore,
    recommendations,
  };
}

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
  if (duration > 480) multiplier = 1.6; // Mid-roll bonus
  else if (duration <= 60) multiplier = 0.4; // Short-form RPM pool

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
