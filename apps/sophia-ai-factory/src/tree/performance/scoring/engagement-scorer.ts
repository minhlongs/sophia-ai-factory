/**
 * Engagement Scoring and Factor Evaluation
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/performance/scoring/engagement-scorer
 */

import type { PerformanceMetrics, ScoreFactor, ScorerConfig } from './types';

export interface EngagementComputation {
  rawRate: number;
  normalizedValue: number;
  denominator: number;
  contribution: number;
  factor: ScoreFactor;
}

/**
 * Computes engagement rate normalization and explainable factor.
 */
export function computeEngagementFactor(
  metrics: PerformanceMetrics,
  config: ScorerConfig,
): EngagementComputation {
  const denominator = Math.max(metrics.views, metrics.impressions, 1);
  const rawRate = metrics.totalEngagements / denominator;
  const normalizedValue = Math.min(
    rawRate / config.engagementSaturation,
    1.0,
  );
  const weight = config.weights.engagementRate;
  const contribution = normalizedValue * weight;

  const factor: ScoreFactor = {
    name: 'engagementRate',
    rawValue: rawRate,
    normalizedValue,
    weight,
    contribution,
    description: `Engagement rate: ${(rawRate * 100).toFixed(2)}% (${metrics.totalEngagements} engagements / ${denominator} views)`,
  };

  return {
    rawRate,
    normalizedValue,
    denominator,
    contribution,
    factor,
  };
}
