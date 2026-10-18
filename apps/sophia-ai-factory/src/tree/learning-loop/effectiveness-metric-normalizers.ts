/**
 * Creative Metric Normalizers for Effectiveness Scorer
 *
 * Layer: tree (domain reusable — only imports from @/seed or local types)
 */

import type { CreativeMetricsInput } from './types';

export function normalizeCtr(metrics: CreativeMetricsInput): number {
  if (typeof metrics.ctr === 'number') {
    return Math.max(0, Math.min(1, metrics.ctr));
  }
  if (metrics.impressions && metrics.impressions > 0) {
    return Math.max(0, Math.min(1, (metrics.clicks ?? 0) / metrics.impressions));
  }
  if (metrics.views && metrics.views > 0) {
    return Math.max(0, Math.min(1, (metrics.clicks ?? 0) / metrics.views));
  }
  return 0;
}

export function normalizeRetention(metrics: CreativeMetricsInput): number {
  if (typeof metrics.retentionRate === 'number') {
    return Math.max(0, Math.min(1, metrics.retentionRate));
  }
  if (
    metrics.totalDurationSeconds &&
    metrics.totalDurationSeconds > 0 &&
    typeof metrics.watchTimeSeconds === 'number'
  ) {
    return Math.max(0, Math.min(1, metrics.watchTimeSeconds / metrics.totalDurationSeconds));
  }
  return 0;
}

export function normalizeConv(metrics: CreativeMetricsInput): number {
  if (typeof metrics.conversionRate === 'number') {
    return Math.max(0, Math.min(1, metrics.conversionRate));
  }
  if (metrics.clicks && metrics.clicks > 0) {
    return Math.max(0, Math.min(1, (metrics.conversions ?? 0) / metrics.clicks));
  }
  if (metrics.views && metrics.views > 0) {
    return Math.max(0, Math.min(1, (metrics.conversions ?? 0) / metrics.views));
  }
  return 0;
}

export function normalizeEfficiency(metrics: CreativeMetricsInput): number {
  if (typeof metrics.efficiencyScore === 'number') {
    return Math.max(0, Math.min(1, metrics.efficiencyScore));
  }
  if (typeof metrics.spendCents === 'number' && metrics.spendCents > 0) {
    const revenue = metrics.revenueCents ?? 0;
    const roas = revenue / metrics.spendCents;
    return Math.max(0, Math.min(1, roas / 3.0));
  }
  if (typeof metrics.revenueCents === 'number' && metrics.revenueCents > 0) {
    return 1.0;
  }
  return 0;
}
