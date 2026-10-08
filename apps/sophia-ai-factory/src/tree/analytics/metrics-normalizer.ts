/**
 * Cross-Platform Video Metrics Normalizer
 * Computes composite Hook Score (0-100) and Retention Score (0-100).
 * Layer: tree (domain algorithms) | LOC: < 200 | Zero :any
 * @module tree/analytics/metrics-normalizer
 */

import type { PlatformRawMetrics, NormalizedVideoMetrics } from '@/seed/types/video-analytics-types';

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export function calculateThreeSecRate(raw: PlatformRawMetrics): number {
  if (raw.threeSecViews !== undefined && raw.views > 0) {
    return clamp(raw.threeSecViews / raw.views, 0, 1);
  }
  if (raw.avgViewPercentage > 0) {
    return clamp(raw.avgViewPercentage / 70, 0, 1);
  }
  return 0;
}

export function calculateFirstQuartileRate(raw: PlatformRawMetrics): number {
  if (raw.firstQuartileViews !== undefined && raw.views > 0) {
    return clamp(raw.firstQuartileViews / raw.views, 0, 1);
  }
  return clamp(calculateThreeSecRate(raw) * 0.85, 0, 1);
}

export function calculateCompletionRate(raw: PlatformRawMetrics): number {
  if (raw.completionCount !== undefined && raw.views > 0) {
    return clamp(raw.completionCount / raw.views, 0, 1);
  }
  if (raw.avgViewPercentage >= 100) {
    return clamp(0.5 + (raw.avgViewPercentage - 100) / 100, 0, 1);
  }
  return clamp((raw.avgViewPercentage / 100) * 0.5, 0, 1);
}

export function calculateEngagementRate(raw: PlatformRawMetrics): number {
  if (raw.views <= 0) return 0;
  const weightedEngagements = raw.likes + raw.comments * 2 + raw.shares * 3 + raw.saves * 2;
  return weightedEngagements / raw.views;
}

export function computeHookScore(threeSecRate: number, firstQuartileRate: number): number {
  const q1Survival = Math.min(1, firstQuartileRate / 0.60);
  const rawScore = 100 * (0.70 * threeSecRate + 0.30 * q1Survival);
  return Math.round(clamp(rawScore, 0, 100) * 10) / 10;
}

export function computeRetentionScore(
  avgViewPercentage: number,
  completionRate: number,
  engagementRate: number,
): number {
  const loopBonus = Math.min(1.5, avgViewPercentage / 100);
  const engBonus = Math.min(1, engagementRate / 0.10);
  const rawScore = 100 * (0.50 * loopBonus + 0.35 * completionRate + 0.15 * engBonus);
  return Math.round(clamp(rawScore, 0, 100) * 10) / 10;
}

export function normalizeVideoMetrics(raw: PlatformRawMetrics): NormalizedVideoMetrics {
  const threeSecViewRate = calculateThreeSecRate(raw);
  const firstQuartileRate = calculateFirstQuartileRate(raw);
  const completionRate = calculateCompletionRate(raw);
  const engagementRate = calculateEngagementRate(raw);
  const hookScore = computeHookScore(threeSecViewRate, firstQuartileRate);
  const retentionScore = computeRetentionScore(raw.avgViewPercentage, completionRate, engagementRate);

  return {
    hookScore,
    retentionScore,
    threeSecViewRate: Math.round(threeSecViewRate * 1000) / 1000,
    firstQuartileRate: Math.round(firstQuartileRate * 1000) / 1000,
    completionRate: Math.round(completionRate * 1000) / 1000,
    avgViewPercentage: Math.round(raw.avgViewPercentage * 10) / 10,
    engagementRate: Math.round(engagementRate * 10000) / 10000,
  };
}
