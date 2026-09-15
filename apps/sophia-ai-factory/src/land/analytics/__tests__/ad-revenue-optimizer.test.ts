import { describe, it, expect } from 'vitest';
import {
  calculateRpm,
  classifyDuration,
  analyzeVideoYield,
  generateChannelOptimizationReport,
  projectAdRevenue,
} from '../ad-revenue-optimizer';
import type { VideoAdMetrics } from '../ad-revenue-optimizer';

describe('calculateRpm', () => {
  it('calculates RPM as revenue per 1000 views', () => {
    expect(calculateRpm(50, 5000)).toBe(10);
  });

  it('rounds to two decimal places', () => {
    const rpm = calculateRpm(123.4567, 7890);
    expect(rpm).toBeCloseTo(15.65, 2);
  });

  it('returns 0 for zero views', () => {
    expect(calculateRpm(100, 0)).toBe(0);
  });

  it('returns 0 for zero revenue', () => {
    expect(calculateRpm(0, 1000)).toBe(0);
  });
});

describe('classifyDuration', () => {
  it('classifies shorts (<=60s)', () => {
    expect(classifyDuration(30)).toBe('short');
    expect(classifyDuration(60)).toBe('short');
  });

  it('classifies mid-form (61-480s)', () => {
    expect(classifyDuration(120)).toBe('mid');
    expect(classifyDuration(480)).toBe('mid');
  });

  it('classifies long-form (>480s)', () => {
    expect(classifyDuration(481)).toBe('long');
    expect(classifyDuration(600)).toBe('long');
  });
});

describe('analyzeVideoYield', () => {
  const baseMetric: VideoAdMetrics = {
    videoId: 'v1',
    views: 10000,
    watchTimeMinutes: 4500,
    estimatedRevenueUsd: 45,
    durationSeconds: 300,
    publishHourUtc: 14,
  };

  it('returns expected fields', () => {
    const result = analyzeVideoYield(baseMetric);
    expect(result.videoId).toBe('v1');
    expect(result.rpm).toBe(4.5);
    expect(result.durationCategory).toBe('mid');
    expect(result.optimizationScore).toBeGreaterThan(0);
  });

  it('computes CPM from RPM', () => {
    const result = analyzeVideoYield(baseMetric);
    expect(result.cpm).toBeCloseTo(4.5 * 1.4, 1);
  });

  it('adds shorts-pacing recommendation for long shorts', () => {
    const metric = { ...baseMetric, durationSeconds: 55, views: 5000, estimatedRevenueUsd: 5 };
    const result = analyzeVideoYield(metric);
    expect(result.recommendations.some(r => r.includes('Shorts'))).toBe(true);
  });

  it('adds 8min threshold recommendation for long mids', () => {
    const metric = { ...baseMetric, durationSeconds: 475, views: 3000, estimatedRevenueUsd: 30 };
    const result = analyzeVideoYield(metric);
    expect(result.recommendations.some(r => r.includes('mid-roll'))).toBe(true);
  });

  it('returns empty recommendations for strong performers', () => {
    const metric = { ...baseMetric, views: 100000, estimatedRevenueUsd: 450 };
    const result = analyzeVideoYield(metric);
    expect(result.recommendations.length).toBe(0);
    expect(result.optimizationScore).toBeGreaterThanOrEqual(80);
  });

  it('returns zero revenue per minute when watchTime is 0', () => {
    const metric = { ...baseMetric, watchTimeMinutes: 0 };
    const result = analyzeVideoYield(metric);
    expect(result.revenuePerMinuteWatched).toBe(0);
  });
});

describe('generateChannelOptimizationReport', () => {
  it('returns empty report when no videos provided', () => {
    const report = generateChannelOptimizationReport([]);
    expect(report.totalViews).toBe(0);
    expect(report.averageRpm).toBe(0);
    expect(report.peakPublishHourUtc).toBeNull();
    expect(report.actionableInsights.length).toBeGreaterThan(0);
  });

  it('identifies top-performing format by RPM', () => {
    const videos: VideoAdMetrics[] = [
      { videoId: 's1', views: 1000, watchTimeMinutes: 50, estimatedRevenueUsd: 2, durationSeconds: 45 },
      { videoId: 'l1', views: 500, watchTimeMinutes: 600, estimatedRevenueUsd: 25, durationSeconds: 600 },
    ];
    const report = generateChannelOptimizationReport(videos);
    expect(report.topPerformingFormat).toBe('long');
    expect(report.formatBreakdown.long.avgRpm).toBeGreaterThan(report.formatBreakdown.short.avgRpm);
  });

  it('calculates totals across formats', () => {
    const videos: VideoAdMetrics[] = [
      { videoId: 'a', views: 1000, watchTimeMinutes: 100, estimatedRevenueUsd: 5, durationSeconds: 30 },
      { videoId: 'b', views: 2000, watchTimeMinutes: 200, estimatedRevenueUsd: 8, durationSeconds: 300 },
    ];
    const report = generateChannelOptimizationReport(videos);
    expect(report.totalViews).toBe(3000);
    expect(report.totalRevenueUsd).toBeCloseTo(13, 2);
    expect(report.averageRpm).toBeCloseTo(13 / 3, 2);
  });

  it('detects peak publish hour from highest view cluster', () => {
    const videos: VideoAdMetrics[] = [
      { videoId: 'a', views: 500, watchTimeMinutes: 50, estimatedRevenueUsd: 5, durationSeconds: 600, publishHourUtc: 8 },
      { videoId: 'b', views: 3000, watchTimeMinutes: 300, estimatedRevenueUsd: 30, durationSeconds: 600, publishHourUtc: 14 },
      { videoId: 'c', views: 200, watchTimeMinutes: 20, estimatedRevenueUsd: 2, durationSeconds: 600, publishHourUtc: 8 },
    ];
    const report = generateChannelOptimizationReport(videos);
    expect(report.peakPublishHourUtc).toBe(14);
  });

  it('recommends long-form when absent and RPM is low', () => {
    const videos: VideoAdMetrics[] = [
      { videoId: 'a', views: 2000, watchTimeMinutes: 100, estimatedRevenueUsd: 3, durationSeconds: 40 },
    ];
    const report = generateChannelOptimizationReport(videos);
    expect(report.actionableInsights.some(r => r.includes('8m+'))).toBe(true);
  });

  it('computes bounded health score', () => {
    const videos: VideoAdMetrics[] = [
      { videoId: 'a', views: 100000, watchTimeMinutes: 10000, estimatedRevenueUsd: 400, durationSeconds: 600 },
    ];
    const report = generateChannelOptimizationReport(videos);
    expect(report.monetizationHealthScore).toBeGreaterThan(0);
    expect(report.monetizationHealthScore).toBeLessThanOrEqual(100);
  });
});

describe('projectAdRevenue', () => {
  it('projects baseline revenue from RPM', () => {
    const projection = projectAdRevenue(10000, 300, 5);
    expect(projection.estimatedRevenueUsd).toBe(50);
  });

  it('applies mid-roll bonus for 8m+ videos', () => {
    const short = projectAdRevenue(10000, 45, 5);
    const long = projectAdRevenue(10000, 600, 5);
    expect(long.estimatedRevenueUsd).toBeGreaterThan(short.estimatedRevenueUsd);
    expect(long.estimatedRevenueUsd).toBeCloseTo(80, 1);
  });

  it('reduces multiplier for short-form', () => {
    const short = projectAdRevenue(10000, 45, 5);
    expect(short.estimatedRevenueUsd).toBeCloseTo(20, 1);
  });

  it('bounds confidence interval symmetrically-ish', () => {
    const projection = projectAdRevenue(10000, 300, 5);
    expect(projection.confidenceMinUsd).toBeLessThan(projection.estimatedRevenueUsd);
    expect(projection.confidenceMaxUsd).toBeGreaterThan(projection.estimatedRevenueUsd);
  });

  it('returns 0 revenue for 0 views', () => {
    const projection = projectAdRevenue(0, 300, 5);
    expect(projection.estimatedRevenueUsd).toBe(0);
    expect(projection.confidenceMinUsd).toBe(0);
    expect(projection.confidenceMaxUsd).toBe(0);
  });
});
