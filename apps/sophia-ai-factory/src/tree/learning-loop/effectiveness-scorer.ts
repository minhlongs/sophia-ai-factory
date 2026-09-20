/**
 * Creative Effectiveness Scorer — Phase 5: Auto-Creative Playbook
 *
 * Computes composite multi-metric creative effectiveness score:
 *   score = (0.35 * ctr) + (0.25 * retention) + (0.30 * conv) + (0.10 * efficiency)
 * with logarithmic confidence saturation and minimum sample size guards (min 5).
 *
 * Layer: tree (domain reusable — only imports from @/seed)
 */

import type {
  CreativeEffectivenessScore,
  CreativeMetricsInput,
} from './types';

/** Minimum sample size required before computing non-zero statistical confidence */
export const MIN_LEARNING_SAMPLE = 5;

/**
 * Logarithmic confidence calculation with sample saturation at N=50.
 * Returns confidence in [0, 1].
 *
 * @param sampleSize   Observed count of interactions/impressions
 * @param consistency  Metric stability / consistency ratio [0, 1] (default 1.0)
 */
export function computeLogarithmicConfidence(sampleSize: number, consistency = 1.0): number {
  if (!Number.isFinite(sampleSize) || sampleSize < MIN_LEARNING_SAMPLE) {
    return 0;
  }

  // Log2 sample score saturates at N=50
  const safeConsistency = Number.isFinite(consistency) ? Math.max(0, Math.min(1, consistency)) : 1.0;
  const sampleScore = Math.min(1, Math.log2(sampleSize + 1) / Math.log2(51));
  const composite = sampleScore * 0.6 + safeConsistency * 0.4;
  return Number.isFinite(composite) ? Math.round(composite * 1000) / 1000 : 0;
}

/**
 * Determine confidence level category from raw confidence score.
 */
export function determineConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (!Number.isFinite(confidence)) return 'low';
  if (confidence >= 0.7) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

function normalizeCtr(metrics: CreativeMetricsInput): number {
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

function normalizeRetention(metrics: CreativeMetricsInput): number {
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

function normalizeConv(metrics: CreativeMetricsInput): number {
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

function normalizeEfficiency(metrics: CreativeMetricsInput): number {
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

/**
 * Calculate multi-metric composite creative effectiveness score.
 *
 * Formula:
 *   score = (0.35 * ctr) + (0.25 * retention) + (0.30 * conv) + (0.10 * efficiency)
 * scaled to 0..100.
 */
export function calculateEffectivenessScore(metrics: CreativeMetricsInput): CreativeEffectivenessScore {
  const ctr = normalizeCtr(metrics);
  const retention = normalizeRetention(metrics);
  const conv = normalizeConv(metrics);
  const efficiency = normalizeEfficiency(metrics);

  const normalizedWeighted = 0.35 * ctr + 0.25 * retention + 0.30 * conv + 0.10 * efficiency;
  const score = Math.round(normalizedWeighted * 100 * 100) / 100;

  const sampleSize =
    metrics.sampleSize ??
    metrics.impressions ??
    metrics.views ??
    metrics.clicks ??
    0;

  const confidence = computeLogarithmicConfidence(sampleSize);
  const confidenceLevel = determineConfidenceLevel(confidence);

  return {
    score,
    ctr: Math.round(ctr * 10000) / 10000,
    retentionRate: Math.round(retention * 10000) / 10000,
    conversionRate: Math.round(conv * 10000) / 10000,
    efficiencyScore: Math.round(efficiency * 10000) / 10000,
    confidence,
    confidenceLevel,
    sampleSize,
  };
}
