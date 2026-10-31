/**
 * Targeting engine weights, saturation thresholds, and helper math.
 *
 * Layer: tree (domain-reusable).
 *
 * @module tree/audience/targeting-weights
 */

import type { AudienceMetrics, AudienceSegment } from './types';

/** Explicit component weight budget — the only place weights live. */
export const COMPONENT_WEIGHTS = {
  platformPresence: 0.3,
  contentFit: 0.25,
  audienceSize: 0.2,
  engagementQuality: 0.15,
  demographicsAlignment: 0.1,
} as const;

/** Followers at which the audience_size component saturates. */
export const AUDIENCE_SIZE_SATURATION = 100_000;

/** Engagement rate at which the engagement_quality component saturates. */
export const ENGAGEMENT_SATURATION = 0.1;

export function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Share of the platform audience that falls inside the segment's age buckets.
 * Returns 0 when either side has no age data.
 */
function ageAlignment(
  segment: AudienceSegment,
  metrics?: AudienceMetrics,
): number {
  const ageBuckets = metrics?.demographics.ageBuckets;
  if (segment.ageBuckets.length === 0 || !ageBuckets) return 0;
  let share = 0;
  for (const bucket of segment.ageBuckets) {
    share += ageBuckets[bucket] ?? 0;
  }
  return clamp01(share);
}

/**
 * Share of the platform audience that falls inside the segment's target genders.
 *
 * Uses the segment's `genderWeights` to score only the declared targets: an
 * audience whose share sits on an unlisted gender earns no weight. Returns 0
 * when the segment declares no target gender or the metrics carry no gender data.
 */
export function genderAlignment(
  segment: AudienceSegment,
  metrics?: AudienceMetrics,
): number {
  const targetGenders = segment.targetGenders;
  const metricGenders = metrics?.demographics.genders;
  if (!targetGenders || targetGenders.length === 0) return 0;
  if (!metricGenders) return 0;

  const weights = segment.genderWeights;
  const sumWeights = weights
    ? targetGenders.reduce((sum, gender) => sum + (weights[gender] ?? 1), 0)
    : targetGenders.length;

  let alignment = 0;
  for (const gender of targetGenders) {
    const weight = weights ? (weights[gender] ?? 1) : 1;
    alignment += (metricGenders[gender] ?? 0) * weight;
  }

  return sumWeights > 0 ? clamp01(alignment / sumWeights) : 0;
}

/**
 * Demographics alignment combining age and gender fit.
 *
 * Blends 60% age alignment with 40% gender alignment only when the segment
 * declares a target gender AND the metrics carry gender data. Every other
 * combination falls back to the pre-existing age-only behavior so historical
 * segments and their tests keep their exact scores.
 */
export function demographicsAlignment(
  segment: AudienceSegment,
  metrics?: AudienceMetrics,
): number {
  const hasGenderTarget =
    segment.targetGenders != null && segment.targetGenders.length > 0;
  const hasGenderMetrics = metrics?.demographics.genders != null;
  if (!hasGenderTarget || !hasGenderMetrics) {
    return ageAlignment(segment, metrics);
  }

  return clamp01(0.6 * ageAlignment(segment, metrics) + 0.4 * genderAlignment(segment, metrics));
}
