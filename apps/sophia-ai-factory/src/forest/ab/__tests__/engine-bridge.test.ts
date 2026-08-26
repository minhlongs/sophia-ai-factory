/**
 * Engine Bridge tests — deterministic fixtures for ab_experiments → Experiment mapping.
 *
 * @module forest/ab/__tests__/engine-bridge
 */

import { describe, it, expect } from 'vitest';
import {
  abExperimentToDomain,
  abExperimentsToDomain,
  mapStatus,
} from '@/forest/ab/engine-bridge';
import type { AbExperiment, ContentType, WinnerVariant, ExperimentStatus } from '@/forest/ab/ab-types';

const FIXED_DATE = new Date('2026-01-15T10:30:00Z').toISOString();
const FIXED_DECIDED = new Date('2026-01-20T14:00:00Z').toISOString();

function makeAbExperiment(overrides: Partial<AbExperiment> = {}): AbExperiment {
  return {
    id: 'ab_exp_001',
    videoId: 'vid_123',
    tenantId: 'ws_001',
    contentType: 'thumbnail' as ContentType,
    variantACaption: 'Caption A',
    variantBCaption: 'Caption B',
    variantAThumbUrl: 'https://example.com/thumb_a.jpg',
    variantBThumbUrl: 'https://example.com/thumb_b.jpg',
    impressionsA: 1000,
    impressionsB: 1200,
    conversionsA: 45,
    conversionsB: 68,
    winner: 'b' as WinnerVariant,
    status: 'decided' as ExperimentStatus,
    createdAt: FIXED_DATE,
    decidedAt: FIXED_DECIDED,
    offerId: 'offer_999',
    bundleId: 'bundle_42',
    ...overrides,
  };
}

describe('mapStatus', () => {
  it('maps active → running', () => {
    expect(mapStatus('active')).toBe('running');
  });

  it('maps decided → completed', () => {
    expect(mapStatus('decided')).toBe('completed');
  });

  it('maps expired → cancelled', () => {
    expect(mapStatus('expired')).toBe('cancelled');
  });

  it('maps unknown → draft', () => {
    expect(mapStatus('unknown' as ExperimentStatus)).toBe('draft');
  });
});

describe('abExperimentToDomain', () => {
  it('maps all fields correctly for a decided experiment', () => {
    const ab = makeAbExperiment();
    const domain = abExperimentToDomain(ab);

    expect(domain.id).toBe('ab_exp_001');
    expect(domain.workspaceId).toBe('ws_001');
    expect(domain.projectId).toBe('vid_123');
    expect(domain.hypothesis).toBe('A/B test for thumbnail: Caption A vs Caption B');
    expect(domain.metric).toBe('click_through_rate');
    expect(domain.audience).toBe('auto');
    expect(domain.channel).toBe('thumbnail');
    expect(domain.status).toBe('completed');
    expect(domain.variants).toHaveLength(2);
    expect(domain.variants[0]).toEqual({
      id: 'ab_exp_001_a',
      experimentId: 'ab_exp_001',
      name: 'A',
      description: 'Caption A',
      assetId: 'https://example.com/thumb_a.jpg',
      trafficPercent: 50,
    });
    expect(domain.variants[1]).toEqual({
      id: 'ab_exp_001_b',
      experimentId: 'ab_exp_001',
      name: 'B',
      description: 'Caption B',
      assetId: 'https://example.com/thumb_b.jpg',
      trafficPercent: 50,
    });
    expect(domain.startedAt).toBe(Math.floor(new Date(FIXED_DATE).getTime() / 1000));
    expect(domain.endedAt).toBe(Math.floor(new Date(FIXED_DECIDED).getTime() / 1000));
    expect(domain.winnerVariantId).toBe('ab_exp_001_b');
    expect(domain.confidence).toBe(0.95);
    expect(domain.result).toBe('Variant B won');
    expect(domain.createdAt).toBe(Math.floor(new Date(FIXED_DATE).getTime() / 1000));
    expect(domain.updatedAt).toBe(Math.floor(new Date(FIXED_DECIDED).getTime() / 1000));
  });

  it('handles active experiment without winner', () => {
    const ab = makeAbExperiment({
      status: 'active',
      winner: null,
      decidedAt: null,
    });
    const domain = abExperimentToDomain(ab);

    expect(domain.status).toBe('running');
    expect(domain.winnerVariantId).toBeUndefined();
    expect(domain.confidence).toBeUndefined();
    expect(domain.result).toBeUndefined();
    expect(domain.endedAt).toBeUndefined();
    expect(domain.updatedAt).toBe(domain.createdAt); // falls back to createdAt when no decidedAt
  });

  it('handles expired experiment', () => {
    const ab = makeAbExperiment({
      status: 'expired',
      winner: 'no_winner',
      decidedAt: FIXED_DECIDED,
    });
    const domain = abExperimentToDomain(ab);

    expect(domain.status).toBe('cancelled');
    expect(domain.winnerVariantId).toBe('ab_exp_001_no_winner');
    expect(domain.confidence).toBe(0.95); // still set when winner present
    expect(domain.result).toBe('Variant NO_WINNER won');
  });

  it('handles missing thumbnail URLs', () => {
    const ab = makeAbExperiment({
      variantAThumbUrl: null,
      variantBThumbUrl: null,
    });
    const domain = abExperimentToDomain(ab);

    expect(domain.variants[0].assetId).toBeUndefined();
    expect(domain.variants[1].assetId).toBeUndefined();
  });

  it('works for all content types', () => {
    const types: ContentType[] = ['thumbnail', 'caption', 'hook', 'cta'];
    for (const type of types) {
      const ab = makeAbExperiment({ contentType: type });
      const domain = abExperimentToDomain(ab);
      expect(domain.channel).toBe(type);
      expect(domain.hypothesis).toContain(type);
    }
  });
});

describe('abExperimentsToDomain', () => {
  it('maps array of experiments', () => {
    const exps = [
      makeAbExperiment({ id: 'ab_1' }),
      makeAbExperiment({ id: 'ab_2', status: 'active', winner: null, decidedAt: null }),
      makeAbExperiment({ id: 'ab_3', status: 'expired' }),
    ];
    const domains = abExperimentsToDomain(exps);

    expect(domains).toHaveLength(3);
    expect(domains[0].id).toBe('ab_1');
    expect(domains[1].id).toBe('ab_2');
    expect(domains[2].id).toBe('ab_3');
    expect(domains[0].status).toBe('completed');
    expect(domains[1].status).toBe('running');
    expect(domains[2].status).toBe('cancelled');
  });

  it('returns empty array for empty input', () => {
    expect(abExperimentsToDomain([])).toEqual([]);
  });
});