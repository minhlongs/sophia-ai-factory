/**
 * Targeting engine tests — determinism, ranking order, explainability.
 * Pure module: no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import {
  scoreSegment,
  rankSegments,
  COMPONENT_WEIGHTS,
  AUDIENCE_SIZE_SATURATION,
  ENGAGEMENT_SATURATION,
} from '../targeting-engine';
import type { AudienceMetrics, AudienceSegment } from '../types';

function makeSegment(overrides: Partial<AudienceSegment> = {}): AudienceSegment {
  return {
    id: 'seg_a',
    workspaceId: 'ws-1',
    name: 'Gen-Z shorts fans',
    platforms: ['tiktok', 'youtube'],
    contentTypes: ['short_video'],
    ageBuckets: ['18-24'],
    countries: [],
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

function makeMetrics(overrides: Partial<AudienceMetrics> = {}): AudienceMetrics {
  return {
    id: 'am_1',
    workspaceId: 'ws-1',
    platform: 'tiktok',
    followers: 50_000,
    engagementRate: 0.05,
    demographics: { ageBuckets: { '18-24': 0.6, '25-34': 0.3 } },
    windowStartMs: 1_700_000_000_000,
    windowEndMs: 1_700_086_400_000,
    createdAt: 1_700_086_400_000,
    ...overrides,
  };
}

describe('scoreSegment', () => {
  it('is deterministic — identical inputs produce identical scores', () => {
    const segment = makeSegment();
    const metrics = makeMetrics();
    const first = scoreSegment(segment, 'tiktok', 'short_video', metrics);
    const second = scoreSegment(segment, 'tiktok', 'short_video', metrics);
    expect(second).toEqual(first);
  });

  it('total score equals the exact sum of named component contributions', () => {
    const ranked = scoreSegment(makeSegment(), 'tiktok', 'short_video', makeMetrics());
    const sum = ranked.components.reduce((acc, c) => acc + c.contribution, 0);
    expect(ranked.score).toBeCloseTo(sum, 6);
  });

  it('is explainable — every component has a name, bounded contribution, and a reason', () => {
    const ranked = scoreSegment(makeSegment(), 'tiktok', 'short_video', makeMetrics());
    expect(ranked.components.length).toBe(5);
    for (const component of ranked.components) {
      expect(component.name.length).toBeGreaterThan(0);
      expect(component.reason.length).toBeGreaterThan(0);
      expect(component.contribution).toBeGreaterThanOrEqual(0);
      expect(component.contribution).toBeLessThanOrEqual(component.maxContribution);
    }
  });

  it('zeroes data-driven components when no metrics exist', () => {
    const ranked = scoreSegment(makeSegment(), 'tiktok', 'short_video', undefined);
    const dataDriven = ranked.components.filter((c) =>
      ['audience_size', 'engagement_quality', 'demographics_alignment'].includes(c.name),
    );
    for (const component of dataDriven) {
      expect(component.contribution).toBe(0);
    }
    expect(ranked.score).toBeCloseTo(0.55, 6);
  });

  it('saturates audience_size and engagement_quality at their caps', () => {
    const metrics = makeMetrics({
      followers: 10 * AUDIENCE_SIZE_SATURATION,
      engagementRate: 5 * ENGAGEMENT_SATURATION,
    });
    const ranked = scoreSegment(makeSegment(), 'tiktok', 'short_video', metrics);
    const size = ranked.components.find((c) => c.name === 'audience_size');
    const engagement = ranked.components.find((c) => c.name === 'engagement_quality');
    expect(size?.contribution).toBeCloseTo(COMPONENT_WEIGHTS.audienceSize, 6);
    expect(engagement?.contribution).toBeCloseTo(COMPONENT_WEIGHTS.engagementQuality, 6);
  });

  it('computes demographics_alignment from age-bucket overlap', () => {
    const ranked = scoreSegment(makeSegment(), 'tiktok', 'short_video', makeMetrics());
    const alignment = ranked.components.find((c) => c.name === 'demographics_alignment');
    // Segment targets 18-24; metrics give that bucket 0.6 share.
    expect(alignment?.contribution).toBeCloseTo(0.6 * COMPONENT_WEIGHTS.demographicsAlignment, 6);
  });

  it('gives zero platform_presence when the segment is not on the platform', () => {
    const ranked = scoreSegment(makeSegment(), 'facebook', 'short_video', undefined);
    const presence = ranked.components.find((c) => c.name === 'platform_presence');
    expect(presence?.contribution).toBe(0);
  });
});

describe('rankSegments', () => {
  it('ranks matching segments above non-matching ones', () => {
    const matching = makeSegment({ id: 'seg_match' });
    const offPlatform = makeSegment({ id: 'seg_off', platforms: ['facebook'] });
    const ranked = rankSegments([offPlatform, matching], 'tiktok', 'short_video', {
      tiktok: makeMetrics(),
    });
    expect(ranked[0].segment.id).toBe('seg_match');
    expect(ranked[1].segment.id).toBe('seg_off');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it('breaks ties deterministically by segment id ascending', () => {
    const b = makeSegment({ id: 'seg_b' });
    const a = makeSegment({ id: 'seg_a' });
    const ranked = rankSegments([b, a], 'tiktok', 'short_video', undefined);
    expect(ranked[0].score).toBe(ranked[1].score);
    expect(ranked[0].segment.id).toBe('seg_a');
    expect(ranked[1].segment.id).toBe('seg_b');
  });

  it('returns an empty array for no segments', () => {
    expect(rankSegments([], 'tiktok', 'short_video')).toEqual([]);
  });
});