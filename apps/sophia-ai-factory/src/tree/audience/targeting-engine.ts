/**
 * Targeting engine — score audience segments per platform + content type.
 *
 * Pure and deterministic: no DB, no network, no randomness. Every score is
 * EXPLAINABLE — the total is exactly the sum of named components, each with
 * an explicit maxContribution. There are no hidden/black-box weights.
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
import {
  COMPONENT_WEIGHTS,
  AUDIENCE_SIZE_SATURATION,
  ENGAGEMENT_SATURATION,
  round6,
  clamp01,
  demographicsAlignment,
} from './targeting-weights';

export {
  COMPONENT_WEIGHTS,
  AUDIENCE_SIZE_SATURATION,
  ENGAGEMENT_SATURATION,
} from './targeting-weights';

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
