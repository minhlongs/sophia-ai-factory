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
import {
  normalizeCtr,
  normalizeRetention,
  normalizeConv,
  normalizeEfficiency,
} from './effectiveness-metric-normalizers';

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
