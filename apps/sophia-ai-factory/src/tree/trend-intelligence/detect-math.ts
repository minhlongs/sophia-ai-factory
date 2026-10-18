/**
 * Pure math for cross-channel trend detection.
 *
 * No DB access, no clock reads (nowMs injected), fully deterministic —
 * unit-testable without any fixture. The DB-backed pipeline lives in
 * detect-pipeline.ts; this module holds only the scoring math.
 *
 * Detection model per (workspace, channel, topic):
 *  - Bucket evidence into fixed-size time windows.
 *  - velocity = count(last window) − count(previous window)
 *    (acceleration of signal volume).
 *  - z = (count(last) − mean(windowCounts)) / stddev(windowCounts),
 *    guarding the zero-variance case.
 *  - momentum = z · seasonalMultiplier · audienceMultiplier
 *    (promote/demote via trend-scorer multipliers, DRY import).
 *
 * Layer: tree (domain reusable)
 *
 * @module tree/trend-intelligence/detect-math
 */

import {
  extractKeywords,
  getAudienceMultiplier,
  getSeasonalMultiplier,
} from '@/tree/youtube-strategy/trend-scorer';
import {
  bucketEvidence,
  type DetectOptions,
  type EvidencePoint,
  type TopicWindowStats,
} from './detect-math-bucketing';

export { bucketEvidence };
export type { DetectOptions, EvidencePoint, TopicWindowStats };

/**
 * Extract topic keywords from free text using trend-scorer's extractor,
 * deduplicated and order-preserving.
 */
export function topicsFromText(text: string): string[] {
  return [...new Set(extractKeywords(text))];
}

/** Population standard deviation over a non-empty series (caller guarantees ≥1 value). */
function stdev(values: readonly number[]): number {
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Compute velocity + z-score + multiplier-weighted momentum for ONE topic's
 * binned counts. Multipliers come from trend-scorer.ts (DRY — imported, not
 * copied). Zero-variance and short-series cases degrade to 0 rather than NaN.
 */
export function computeTopicMomentum(
  topic: string,
  windowCounts: readonly number[],
): TopicWindowStats {
  const counts = [...windowCounts];
  let velocity = 0;
  let z = 0;

  const last = counts[counts.length - 1];
  if (counts.length >= 2) {
    const prev = counts[counts.length - 2];
    velocity = last - prev;
    const sd = stdev(counts);
    const mean = counts.reduce((acc, v) => acc + v, 0) / counts.length;
    if (sd > 0) {
      z = (last - mean) / sd;
    }
  }

  const seasonalMultiplier = getSeasonalMultiplier(topic);
  const audienceMultiplier = getAudienceMultiplier(topic);
  const momentum = z * seasonalMultiplier * audienceMultiplier;

  return {
    topic,
    windowCounts: counts,
    velocity,
    z,
    seasonalMultiplier,
    audienceMultiplier,
    momentum,
  };
}
