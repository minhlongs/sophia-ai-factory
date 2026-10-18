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
export function demographicsAlignment(
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
