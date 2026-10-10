/**
 * Retention and Velocity Scoring Helpers
 * Layer: tree (domain-specific reusable)
 *
 * @module tree/performance/scoring/retention-scorer
 */

import type { PerformanceMetrics, ScoreFactor, ScorerConfig } from './types';

export interface RetentionAccumulator {
  r3sSum: number;
  r30sSum: number;
  count: number;
}

/**
 * Safely parses metrics_json to extract retention metrics.
 */
export function accumulateRetention(metricsJson: string, acc: RetentionAccumulator): void {
  try {
    const metrics = JSON.parse(metricsJson) as Record<string, unknown>;
    if (typeof metrics.retention3s === 'number') {
      acc.r3sSum += metrics.retention3s;
      acc.count++;
    }
    if (typeof metrics.retention30s === 'number') {
      acc.r30sSum += metrics.retention30s;
      acc.count++;
    }
  } catch {
    // ignore malformed metrics_json
  }
}

/**
 * Computes velocity and explainable velocity factor.
 */
export function computeVelocityFactor(
  metrics: PerformanceMetrics,
  config: ScorerConfig,
): { rawVelocity: number; normalizedVelocity: number; windowDays: number; contribution: number; factor: ScoreFactor } {
  const windowDays = Math.max(
    (metrics.windowEnd - metrics.windowStart) / (1000 * 60 * 60 * 24),
    1 / 24, // minimum 1 hour to avoid division by zero
  );
  const rawVelocity = metrics.eventCount / windowDays;
  const normalizedVelocity = Math.min(rawVelocity / config.velocitySaturation, 1.0);
  const weight = config.weights.velocity;
  const contribution = normalizedVelocity * weight;

  const factor: ScoreFactor = {
    name: 'velocity',
    rawValue: rawVelocity,
    normalizedValue: normalizedVelocity,
    weight,
    contribution,
    description: `Velocity: ${rawVelocity.toFixed(2)} events/day over ${windowDays.toFixed(1)} days (${metrics.eventCount} events)`,
  };

  return { rawVelocity, normalizedVelocity, windowDays, contribution, factor };
}

/**
 * Computes retention and explainable retention factor.
 */
export function computeRetentionFactor(
  metrics: PerformanceMetrics,
  config: ScorerConfig,
): { rawRetention: number; normalizedRetention: number; contribution: number; factor: ScoreFactor } {
  const rawRetention =
    metrics.retention30s > 0
      ? metrics.retention30s
      : metrics.retention3s > 0
        ? metrics.retention3s
        : 0.5;

  const normalizedRetention = Math.max(0, Math.min(rawRetention, 1.0));
  const weight = config.weights.retention;
  const contribution = normalizedRetention * weight;

  const factor: ScoreFactor = {
    name: 'retention',
    rawValue: rawRetention,
    normalizedValue: normalizedRetention,
    weight,
    contribution,
    description: `Retention (30s): ${(rawRetention * 100).toFixed(1)}%` + (metrics.retention30s === 0 ? ' (fallback)' : ''),
  };

  return { rawRetention, normalizedRetention, contribution, factor };
}
