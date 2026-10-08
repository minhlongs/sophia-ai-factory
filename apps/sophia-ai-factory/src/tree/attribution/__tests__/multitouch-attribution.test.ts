/**
 * @file multitouch-attribution.test.ts
 * @description Unit tests for multi-touch attribution algorithms and LTV/CAC ratio calculations
 */

import { describe, it, expect } from 'vitest';
import {
  calculateAttributionWeights,
  calculateLtvCacRatio,
  type RawTouchpoint,
} from '../multitouch-attribution';

describe('Omnichannel Attribution Engine (Tree Layer)', () => {
  const now = 1770000000000;
  const mockTouchpoints: RawTouchpoint[] = [
    { channel: 'TIKTOK_CREATOR', timestamp: now - 14 * 24 * 3600 * 1000 },
    { channel: 'GOOGLE_SEARCH', timestamp: now - 7 * 24 * 3600 * 1000 },
    { channel: 'B2B_COLD_EMAIL', timestamp: now },
  ];

  it('allocates 100% to first touchpoint under FIRST_TOUCH model', () => {
    const res = calculateAttributionWeights(mockTouchpoints, 1000, 'FIRST_TOUCH');
    expect(res).toHaveLength(3);
    expect(res[0].channel).toBe('TIKTOK_CREATOR');
    expect(res[0].weightPercentage).toBe(100);
    expect(res[0].attributedGmv).toBe(1000);
    expect(res[1].weightPercentage).toBe(0);
    expect(res[2].weightPercentage).toBe(0);
  });

  it('allocates 100% to last touchpoint under LAST_TOUCH model', () => {
    const res = calculateAttributionWeights(mockTouchpoints, 1000, 'LAST_TOUCH');
    expect(res).toHaveLength(3);
    expect(res[2].channel).toBe('B2B_COLD_EMAIL');
    expect(res[2].weightPercentage).toBe(100);
    expect(res[2].attributedGmv).toBe(1000);
    expect(res[0].weightPercentage).toBe(0);
    expect(res[1].weightPercentage).toBe(0);
  });

  it('weights recent touchpoints higher under TIME_DECAY model', () => {
    const res = calculateAttributionWeights(mockTouchpoints, 1000, 'TIME_DECAY');
    expect(res).toHaveLength(3);
    // Most recent touchpoint should have the largest weight
    expect(res[2].weightPercentage).toBeGreaterThan(res[1].weightPercentage);
    expect(res[1].weightPercentage).toBeGreaterThan(res[0].weightPercentage);

    const sumWeights = res.reduce((acc, r) => acc + r.weightPercentage, 0);
    expect(Math.round(sumWeights)).toBe(100);
  });

  it('correctly calculates LTV/CAC ratio', () => {
    expect(calculateLtvCacRatio(500, 100)).toBe(5.0);
    expect(calculateLtvCacRatio(250, 80)).toBe(3.13);
    expect(calculateLtvCacRatio(500, 0)).toBe(99.9);
    expect(calculateLtvCacRatio(0, 100)).toBe(0);
  });
});
