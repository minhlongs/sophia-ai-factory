/**
 * Video RPM/CPM Yield Calculator & Individual Video Analysis
 *
 * Layer: land/analytics/ad-revenue-optimizer
 */

import type { DurationCategory, VideoAdMetrics, VideoYieldAnalysis } from './types';

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
