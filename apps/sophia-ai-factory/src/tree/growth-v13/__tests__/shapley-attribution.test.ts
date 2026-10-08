import { describe, it, expect } from 'vitest';
import {
  calculateShapleyWeights,
  computeShapleyAttribution,
} from '../shapley-attribution';
import { TouchpointRecord } from '@/seed/types/growth-triad-v13';

describe('Game-Theoretic Shapley Value Attribution Engine', () => {
  const now = 1760000000000;

  it('assigns 1.0 weight to a single touchpoint journey', () => {
    const touchpoints: TouchpointRecord[] = [
      {
        videoManifestId: 'v1',
        channelId: 'c1',
        platform: 'YOUTUBE_SHORTS',
        timestamp: now - 3600000,
        mcuCostUsd: 1.0,
      },
    ];
    const weights = calculateShapleyWeights(touchpoints, now);
    expect(weights).toEqual([1.0]);
  });

  it('allocates Shapley cooperative weights across 3 touchpoints', () => {
    const touchpoints: TouchpointRecord[] = [
      {
        videoManifestId: 'v1',
        channelId: 'c1',
        platform: 'YOUTUBE_SHORTS',
        timestamp: now - 86400000 * 2,
        mcuCostUsd: 1.0,
      },
      {
        videoManifestId: 'v2',
        channelId: 'c2',
        platform: 'TIKTOK_V2',
        timestamp: now - 86400000,
        mcuCostUsd: 1.0,
      },
      {
        videoManifestId: 'v3',
        channelId: 'c3',
        platform: 'INSTAGRAM_REELS',
        timestamp: now - 3600000,
        mcuCostUsd: 1.0,
      },
    ];
    const weights = calculateShapleyWeights(touchpoints, now);
    expect(weights).toHaveLength(3);
    const sum = weights.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 2);
  });

  it('computes complete Shapley attribution result with ROAS and net margins', () => {
    const touchpoints: TouchpointRecord[] = [
      {
        videoManifestId: 'v1',
        channelId: 'c1',
        platform: 'YOUTUBE_SHORTS',
        timestamp: now - 3600000,
        mcuCostUsd: 2.0,
      },
      {
        videoManifestId: 'v2',
        channelId: 'c2',
        platform: 'TIKTOK_V2',
        timestamp: now - 1800000,
        mcuCostUsd: 2.0,
      },
    ];

    const result = computeShapleyAttribution('conv-101', 200.0, 80.0, touchpoints, now);
    expect(result.conversionId).toBe('conv-101');
    expect(result.totalGrossRevenueUsd).toBe(200.0);
    expect(result.totalCommissionUsd).toBe(80.0);
    expect(result.touchpoints).toHaveLength(2);
    // Total cost = 4.0, Total commission = 80.0 => ROAS = 20.0
    expect(result.overallRoas).toBe(20.0);
    expect(result.touchpoints[0].netProfitUsd).toBeGreaterThan(0);
  });
});
