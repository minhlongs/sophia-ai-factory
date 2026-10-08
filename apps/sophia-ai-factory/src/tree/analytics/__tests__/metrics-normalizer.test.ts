/**
 * Unit Tests for Metrics Normalizer
 * Validates Hook Score (0-100), Retention Score (0-100), and Platform Normalization.
 *
 * @module tree/analytics/__tests__/metrics-normalizer.test
 */

import { describe, it, expect } from 'vitest';
import {
  calculateThreeSecRate,
  calculateFirstQuartileRate,
  calculateCompletionRate,
  calculateEngagementRate,
  computeHookScore,
  computeRetentionScore,
  normalizeVideoMetrics,
} from '../metrics-normalizer';
import type { PlatformRawMetrics } from '@/seed/types/video-analytics-types';

describe('Metrics Normalizer', () => {
  const mockRaw: PlatformRawMetrics = {
    views: 1000,
    watchTimeSeconds: 25000,
    avgViewDurationSeconds: 25,
    avgViewPercentage: 85,
    threeSecViews: 800,
    firstQuartileViews: 650,
    completionCount: 450,
    likes: 80,
    comments: 10,
    shares: 20,
    saves: 30,
  };

  it('calculates 3-second view rate correctly', () => {
    const rate = calculateThreeSecRate(mockRaw);
    expect(rate).toBe(0.8);
  });

  it('calculates first quartile rate correctly', () => {
    const rate = calculateFirstQuartileRate(mockRaw);
    expect(rate).toBe(0.65);
  });

  it('calculates completion rate correctly', () => {
    const rate = calculateCompletionRate(mockRaw);
    expect(rate).toBe(0.45);
  });

  it('calculates engagement rate with weighted interactions', () => {
    // likes(80) + comments(10*2=20) + shares(20*3=60) + saves(30*2=60) = 220 / 1000 = 0.22
    const rate = calculateEngagementRate(mockRaw);
    expect(rate).toBe(0.22);
  });

  it('computes composite Hook Score clamped between 0 and 100', () => {
    const score = computeHookScore(0.8, 0.65);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBe(86); // 100 * (0.7 * 0.8 + 0.3 * min(1, 0.65/0.6)) = 100 * (0.56 + 0.3) = 86
  });

  it('computes composite Retention Score including loop bonus', () => {
    const score = computeRetentionScore(120, 0.6, 0.05); // 120% loop watching
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('normalizes full platform raw metrics into rounded indices', () => {
    const normalized = normalizeVideoMetrics(mockRaw);
    expect(normalized.hookScore).toBe(86);
    expect(normalized.threeSecViewRate).toBe(0.8);
    expect(normalized.firstQuartileRate).toBe(0.65);
    expect(normalized.completionRate).toBe(0.45);
    expect(normalized.engagementRate).toBe(0.22);
  });

  it('handles edge case of 0 views gracefully', () => {
    const zeroRaw: PlatformRawMetrics = {
      views: 0,
      watchTimeSeconds: 0,
      avgViewDurationSeconds: 0,
      avgViewPercentage: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
    };
    const normalized = normalizeVideoMetrics(zeroRaw);
    expect(normalized.hookScore).toBe(0);
    expect(normalized.retentionScore).toBe(0);
    expect(normalized.threeSecViewRate).toBe(0);
  });
});
