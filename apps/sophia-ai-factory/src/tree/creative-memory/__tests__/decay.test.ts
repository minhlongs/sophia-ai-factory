/**
 * tree/creative-memory/decay — unit tests
 *
 * Pure computation: 30-day half-life exponential decay. No DB, no mocks.
 * All calls pass an explicit `nowMs` so results are deterministic.
 */

import { describe, it, expect } from 'vitest';
import {
  computeDecayedConfidence,
  computeDecayScore,
  filterActiveMemories,
} from '@/tree/creative-memory/decay';
import type { MemoryConfidence } from '@/seed/types/creative-domain';

const DAY = 24 * 60 * 60 * 1000;
const HALF_LIFE = 30 * DAY;
const T0 = 0; // arbitrary epoch anchor

describe('computeDecayScore', () => {
  it('returns the base score at zero elapsed time', () => {
    expect(computeDecayScore('high', T0, T0)).toBeCloseTo(1.0, 10);
    expect(computeDecayScore('medium', T0, T0)).toBeCloseTo(0.6, 10);
    expect(computeDecayScore('low', T0, T0)).toBeCloseTo(0.3, 10);
  });

  it('halves the score every 30 days', () => {
    expect(computeDecayScore('high', T0, T0 + HALF_LIFE)).toBeCloseTo(0.5, 10);
    expect(computeDecayScore('high', T0, T0 + 2 * HALF_LIFE)).toBeCloseTo(0.25, 10);
    expect(computeDecayScore('high', T0, T0 + 3 * HALF_LIFE)).toBeCloseTo(0.125, 10);
  });

  it('decays each confidence tier on the same half-life', () => {
    expect(computeDecayScore('medium', T0, T0 + HALF_LIFE)).toBeCloseTo(0.3, 10);
    expect(computeDecayScore('low', T0, T0 + HALF_LIFE)).toBeCloseTo(0.15, 10);
  });

  it('clamps negative elapsed time to zero (clock skew)', () => {
    expect(computeDecayScore('high', T0 + HALF_LIFE, T0)).toBeCloseTo(1.0, 10);
  });

  it('approaches zero asymptotically without going negative', () => {
    const score = computeDecayScore('high', T0, T0 + 365 * DAY);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(0.01);
  });
});

describe('computeDecayedConfidence', () => {
  it('preserves confidence at zero elapsed time', () => {
    const now = T0;
    expect(computeDecayedConfidence('high', T0, now)).toBe('high');
    expect(computeDecayedConfidence('medium', T0, now)).toBe('medium');
    expect(computeDecayedConfidence('low', T0, now)).toBe('low');
  });

  it('downgrades high → medium after one half-life', () => {
    expect(computeDecayedConfidence('high', T0, T0 + HALF_LIFE)).toBe('medium');
  });

  it('downgrades high → low after two half-lives', () => {
    expect(computeDecayedConfidence('high', T0, T0 + 2 * HALF_LIFE)).toBe('low');
  });

  it('keeps low confidence at low after a half-life', () => {
    expect(computeDecayedConfidence('low', T0, T0 + HALF_LIFE)).toBe('low');
  });

  it('uses the default nowMs when omitted', () => {
    // default is Date.now(); just confirm it returns a valid label
    const result = computeDecayedConfidence('high', T0);
    expect(['high', 'medium', 'low']).toContain(result);
  });

  it('is consistent with the numeric score at the same inputs', () => {
    const score = computeDecayScore('high', T0, T0 + HALF_LIFE);
    const label = computeDecayedConfidence('high', T0, T0 + HALF_LIFE);
    // 0.5 → medium (>= 0.4), so the label must match the score's band
    expect(score).toBeGreaterThanOrEqual(0.4);
    expect(label).toBe('medium');
  });
});

interface SampleMemory {
  confidence: MemoryConfidence;
  updatedAt: number;
  label: string;
}

describe('filterActiveMemories', () => {
  const memories: SampleMemory[] = [
    { confidence: 'high', updatedAt: T0, label: 'fresh-high' },
    { confidence: 'high', updatedAt: T0 - 2 * HALF_LIFE, label: 'stale-high' },
    { confidence: 'low', updatedAt: T0, label: 'fresh-low' },
    { confidence: 'medium', updatedAt: T0 - HALF_LIFE, label: 'aged-medium' },
  ];

  it('keeps memories above the default minimum score (0.2)', () => {
    const active = filterActiveMemories(memories, T0);
    const labels = active.map((m) => m.label);
    // fresh-high (1.0), aged-medium (0.3), fresh-low (0.3) all >= 0.2; stale-high (0.25) also >= 0.2
    expect(labels).toContain('fresh-high');
    expect(labels).toContain('aged-medium');
    expect(labels).toContain('fresh-low');
    expect(labels).toContain('stale-high');
  });

  it('drops stale memories when the threshold rises', () => {
    const active = filterActiveMemories(memories, 0.3, T0);
    const labels = active.map((m) => m.label);
    expect(labels).toEqual(expect.arrayContaining(['fresh-high', 'aged-medium', 'fresh-low']));
    expect(labels).not.toContain('stale-high');
  });

  it('returns an empty array when everything is stale', () => {
    const allStale: SampleMemory[] = [
      { confidence: 'high', updatedAt: T0 - 10 * HALF_LIFE, label: 'ancient' },
    ];
    expect(filterActiveMemories(allStale, 0.2, T0)).toEqual([]);
  });

  it('returns all memories when the threshold is zero', () => {
    expect(filterActiveMemories(memories, 0, T0)).toHaveLength(memories.length);
  });

  it('does not mutate the input array', () => {
    const before = memories.slice();
    filterActiveMemories(memories, 0.5, T0);
    expect(memories).toEqual(before);
  });
});