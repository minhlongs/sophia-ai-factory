/**
 * Unit tests: analytics normalizer — micro USD → USD cents conversion.
 * YouTube reports estimatedRevenue in micro USD (1 USD = 1,000,000).
 * cents = microUSD ÷ 10⁶ × 100 = microUSD ÷ 10⁴, rounded, clamped ≥ 0.
 */

import { describe, it, expect } from 'vitest';
import { normalizeYouTubeMetrics } from '../analytics-normalizer';
import type { YouTubeAnalyticsRow } from '../youtube-analytics-fetcher';

function makeRow(overrides: Partial<YouTubeAnalyticsRow> = {}): YouTubeAnalyticsRow {
  return {
    videoId: 'vid-1',
    date: '2026-08-01',
    views: 100,
    estimatedMinutesWatched: 60,
    averageViewDuration: 36,
    impressions: 1000,
    impressionClickThroughRate: 4.5,
    likes: 5,
    comments: 2,
    shares: 1,
    estimatedRevenue: 0,
    ...overrides,
  };
}

describe('normalizeYouTubeMetrics — estimatedRevenueCents', () => {
  const cases: Array<[microUsd: number, expectedCents: number]> = [
    [1_000_000, 100],   // exactly $1.00
    [999_999, 100],     // 99.9999 rounds up to 100
    [1, 0],             // sub-cent rounds down
    [0, 0],             // zero stays zero
    [12_345, 1],        // 1.2345 rounds to 1
    [2_500_000, 250],   // $2.50
    [-50_000, 0],       // malformed negative input clamped to 0
  ];

  it.each(cases)('converts %i microUSD to %i cents', (microUsd, expectedCents) => {
    const result = normalizeYouTubeMetrics(makeRow({ estimatedRevenue: microUsd }));
    expect(result.estimatedRevenueCents).toBe(expectedCents);
  });

  it('keeps existing normalized fields intact alongside revenue', () => {
    const result = normalizeYouTubeMetrics(
      makeRow({ estimatedRevenue: 1_000_000, views: 100, likes: 5, comments: 2, shares: 3 }),
    );
    expect(result.videoId).toBe('vid-1');
    expect(result.date).toBe('2026-08-01');
    expect(result.views).toBe(100);
    expect(result.watchTimeSec).toBe(3600);
    expect(result.ctr).toBeCloseTo(0.045);
    expect(result.engagementRate).toBeCloseTo(0.1);
    expect(result.estimatedRevenueCents).toBe(100);
  });
});
