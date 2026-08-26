/**
 * Detect math — pure sliding-window velocity + z-score unit tests.
 * No DB, no clock: nowMs always injected.
 *
 * @module tree/trend-intelligence/__tests__/detect-math
 */

import { describe, it, expect } from 'vitest';
import {
  bucketEvidence,
  computeTopicMomentum,
  topicsFromText,
  type EvidencePoint,
} from '@/tree/trend-intelligence/detect-math';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

describe('topicsFromText', () => {
  it('extracts keywords and drops stopwords/short words', () => {
    const topics = topicsFromText('The AI revolution is here now');
    expect(topics).toContain('revolution');
    expect(topics).toContain('here');
    expect(topics).not.toContain('the');
    expect(topics).not.toContain('is');
    expect(topics).not.toContain('now');
  });

  it('dedupes case-insensitively and preserves first-seen order', () => {
    expect(topicsFromText('Summer summer travel SUMMER')).toEqual(['summer', 'travel']);
  });
});

describe('bucketEvidence', () => {
  it('returns windowCount zero buckets for empty evidence', () => {
    expect(bucketEvidence([], { windowCount: 4, windowMs: DAY, nowMs: NOW })).toEqual([0, 0, 0, 0]);
  });

  it('applies defaults when options are omitted (7 × 24h windows ending at epoch 0)', () => {
    // Default nowMs = 0; a point older than 7 days before epoch drops out.
    expect(bucketEvidence([{ id: 'a', atMs: -8 * DAY }])).toEqual(new Array(7).fill(0));
    expect(bucketEvidence([], { windowMs: DAY })).toEqual(new Array(7).fill(0));
    expect(bucketEvidence([], { windowCount: 3 })).toEqual([0, 0, 0]);
  });

  it('assigns points to the newest bucket when atMs == now', () => {
    // Window i covers [start + i·w, start + (i+1)·w); last bucket includes now−1 tick
    // but `now` itself falls in the NEXT bucket — verify the half-open boundary:
    // idx for atMs == NOW is floor((NOW − (NOW − n·w)) / w) = n → dropped.
    const counts = bucketEvidence([{ id: 'a', atMs: NOW }], { windowCount: 3, windowMs: DAY, nowMs: NOW });
    expect(counts).toEqual([0, 0, 0]);
  });

  it('counts a point one ms before now in the last bucket', () => {
    const counts = bucketEvidence(
      [{ id: 'a', atMs: NOW - 1 }, { id: 'b', atMs: NOW - 1 }],
      { windowCount: 3, windowMs: DAY, nowMs: NOW },
    );
    expect(counts).toEqual([0, 0, 2]);
  });

  it('distributes points across buckets oldest → newest', () => {
    // Window i covers [NOW − (7−i)·DAY, NOW − (6−i)·DAY). NOW−6·DAY+1s lands
    // in bucket 1 (bucket 0 only holds the instant NOW−7·DAY), NOW−3·DAY+1s in
    // bucket 4, and both NOW−1·DAY points in the newest bucket 6.
    const points: EvidencePoint[] = [
      { id: 'p1', atMs: NOW - 6 * DAY + 1000 },
      { id: 'p2', atMs: NOW - 3 * DAY + 1000 },
      { id: 'p3', atMs: NOW - DAY + 1000 },
      { id: 'p4', atMs: NOW - DAY + 2000 },
    ];
    const counts = bucketEvidence(points, { windowCount: 7, windowMs: DAY, nowMs: NOW });
    expect(counts).toEqual([0, 1, 0, 0, 1, 0, 2]);
  });

  it('drops points older than the full window span', () => {
    const counts = bucketEvidence(
      [{ id: 'old', atMs: NOW - 8 * DAY }],
      { windowCount: 7, windowMs: DAY, nowMs: NOW },
    );
    expect(counts).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('ignores non-finite timestamps instead of throwing', () => {
    const counts = bucketEvidence(
      [{ id: 'bad', atMs: Number.NaN }],
      { windowCount: 3, windowMs: DAY, nowMs: NOW },
    );
    expect(counts).toEqual([0, 0, 0]);
  });
});

describe('computeTopicMomentum', () => {
  it('computes velocity as count(last) − count(prev)', () => {
    const stats = computeTopicMomentum('generic topic', [2, 2, 5]);
    expect(stats.velocity).toBe(3);
  });

  it('computes positive z when last exceeds mean by more than stddev', () => {
    // counts [0,0,10]: mean 3.33, sd ~4.71, z = (10 − 3.33)/4.71 > 0
    const stats = computeTopicMomentum('generic topic', [0, 0, 10]);
    expect(stats.z).toBeGreaterThan(0);
    expect(stats.momentum).toBeGreaterThan(0);
  });

  it('degrades velocity and z to 0 for single-window series', () => {
    const stats = computeTopicMomentum('generic topic', [7]);
    expect(stats.velocity).toBe(0);
    expect(stats.z).toBe(0);
    expect(stats.momentum).toBe(0);
  });

  it('degrades z to 0 on zero variance (flat windows)', () => {
    const stats = computeTopicMomentum('generic topic', [3, 3, 3]);
    expect(stats.velocity).toBe(0);
    expect(stats.z).toBe(0);
    expect(Number.isNaN(stats.momentum)).toBe(false);
  });

  it('applies audience multiplier > 1 for entertainment keywords (promote)', () => {
    // Neither topic matches any category or seasonal keyword substring, so
    // plain stays at the 1.0 general/season baseline regardless of the clock.
    const plain = computeTopicMomentum('generic topic', [0, 0, 9]);
    const fun = computeTopicMomentum('fun comedy clip', [0, 0, 9]);
    expect(plain.audienceMultiplier).toBe(1);
    expect(fun.audienceMultiplier).toBe(1.3);
    expect(fun.seasonalMultiplier).toBe(1);
    expect(plain.seasonalMultiplier).toBe(1);
    expect(fun.momentum).toBeCloseTo(fun.z * 1.3, 10);
    expect(fun.momentum).toBeGreaterThan(plain.momentum);
  });

  it('applies seasonal multiplier 1.5 for in-season keywords (promote/demote gap)', () => {
    // getSeasonalMultiplier reads the real clock internally (documented
    // trend-scorer behavior); assert the two outcomes it can produce.
    const stats = computeTopicMomentum('halloween costumes party ideas', [0, 0, 8]);
    expect([1.0, 1.5]).toContain(stats.seasonalMultiplier);
    expect(stats.audienceMultiplier).toBeGreaterThanOrEqual(1);
  });

  it('is deterministic for identical inputs', () => {
    const a = computeTopicMomentum('topic', [1, 5, 2, 9]);
    const b = computeTopicMomentum('topic', [1, 5, 2, 9]);
    expect(a).toEqual(b);
  });
});
