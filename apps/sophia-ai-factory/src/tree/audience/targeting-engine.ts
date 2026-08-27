/**
 * Targeting engine — score audience segments per platform + content type.
 *
 * Pure and deterministic: no DB, no network, no randomness. Every score is
 * EXPLAINABLE — the total is exactly the sum of named components, each with
 * an explicit maxContribution. There are no hidden/black-box weights.
 *
 * Component budget (sums to 1.0):
 *   platform_presence     0.30 — segment is active on the target platform
 *   content_fit           0.25 — segment targets the content type
 *   audience_size         0.20 — follower count, saturates at 100k
 *   engagement_quality    0.15 — engagement rate, saturates at 10%
 *   demographics_alignment 0.10 — overlap of segment age buckets with audience
 *
 * Layer: tree (domain-reusable). Imports seed only (types.ts is tree-local).
 *
 * @module tree/audience/targeting-engine
 */

import type {
  AudienceMetrics,
  AudiencePlatform,
  AudienceSegment,
  ContentType,
  RankedSegment,
  ScoreComponent,
} from './types';

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

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Score one segment for one platform + content type.
 * `metrics` is the latest metrics row for that platform (optional — missing
 * metrics zero out the data-driven components, never the presence/fit ones).
 */
export function scoreSegment(
  segment: AudienceSegment,
  platform: AudiencePlatform,
  contentType: ContentType,
  metrics?: AudienceMetrics,
): RankedSegment {
  const components: ScoreComponent[] = [];

  const onPlatform = segment.platforms.includes(platform);
  components.push({
    name: 'platform_presence',
    contribution: onPlatform ? COMPONENT_WEIGHTS.platformPresence : 0,
    maxContribution: COMPONENT_WEIGHTS.platformPresence,
    reason: onPlatform
      ? `Segment is active on ${platform}`
      : `Segment does not target ${platform}`,
  });

  const fitsContent = segment.contentTypes.includes(contentType);
  components.push({
    name: 'content_fit',
    contribution: fitsContent ? COMPONENT_WEIGHTS.contentFit : 0,
    maxContribution: COMPONENT_WEIGHTS.contentFit,
    reason: fitsContent
      ? `Segment targets ${contentType} content`
      : `Segment does not target ${contentType} content`,
  });

  const sizeRatio = metrics ? clamp01(metrics.followers / AUDIENCE_SIZE_SATURATION) : 0;
  components.push({
    name: 'audience_size',
    contribution: round6(sizeRatio * COMPONENT_WEIGHTS.audienceSize),
    maxContribution: COMPONENT_WEIGHTS.audienceSize,
    reason: metrics
      ? `${metrics.followers} followers on ${platform} (saturates at ${AUDIENCE_SIZE_SATURATION})`
      : `No metrics available for ${platform}`,
  });

  const engagementRatio = metrics ? clamp01(metrics.engagementRate / ENGAGEMENT_SATURATION) : 0;
  components.push({
    name: 'engagement_quality',
    contribution: round6(engagementRatio * COMPONENT_WEIGHTS.engagementQuality),
    maxContribution: COMPONENT_WEIGHTS.engagementQuality,
    reason: metrics
      ? `${(metrics.engagementRate * 100).toFixed(1)}% engagement (saturates at ${ENGAGEMENT_SATURATION * 100}%)`
      : `No metrics available for ${platform}`,
  });

  const alignment = demographicsAlignment(segment, metrics);
  components.push({
    name: 'demographics_alignment',
    contribution: round6(alignment * COMPONENT_WEIGHTS.demographicsAlignment),
    maxContribution: COMPONENT_WEIGHTS.demographicsAlignment,
    reason:
      segment.ageBuckets.length === 0
        ? 'Segment declares no age preference'
        : metrics
          ? `Audience share in segment age buckets: ${(alignment * 100).toFixed(1)}%`
          : `No demographics data for ${platform}`,
  });

  const score = round6(components.reduce((sum, c) => sum + c.contribution, 0));
  return { segment, platform, contentType, score, components };
}

/**
 * Share of the platform audience that falls inside the segment's age buckets.
 * Returns 0 when either side has no age data.
 */
function demographicsAlignment(
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
 * Rank all segments for one platform + content type.
 * Deterministic order: score descending, then segment id ascending as the
 * tie-breaker, so identical inputs always produce identical rankings.
 */
export function rankSegments(
  segments: AudienceSegment[],
  platform: AudiencePlatform,
  contentType: ContentType,
  metricsByPlatform?: Partial<Record<AudiencePlatform, AudienceMetrics>>,
): RankedSegment[] {
  const ranked = segments.map((segment) =>
    scoreSegment(segment, platform, contentType, metricsByPlatform?.[platform]),
  );
  ranked.sort((a, b) => b.score - a.score || a.segment.id.localeCompare(b.segment.id));
  return ranked;
}
