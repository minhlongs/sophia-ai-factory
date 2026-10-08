/**
 * Unit Tests for Darwinian Hook Mutator
 * Layer: tree/growth-v12/__tests__ | Max LOC: < 200 | Zero :any
 */

import { describe, it, expect } from 'vitest';
import { mutateViralHook, calculateJaccardDivergence } from '../hook-mutator';

describe('Hook Mutator Domain Logic', () => {
  it('calculates Jaccard divergence correctly', () => {
    const divIdentical = calculateJaccardDivergence('hello world', 'hello world');
    expect(divIdentical).toBe(0);

    const divDifferent = calculateJaccardDivergence('apple banana', 'cat dog');
    expect(divDifferent).toBe(1);
  });

  it('generates 3 mutated hooks exceeding minimum divergence threshold', () => {
    const original = 'Top 3 AI Tools For Fast Cashflow';
    const result = mutateViralHook(original, 3);

    expect(result.mutatedHooks.length).toBe(3);
    expect(result.meanDivergence).toBeGreaterThan(0.2);
    result.mutatedHooks.forEach((h) => {
      expect(h.length).toBeGreaterThan(original.length);
    });
  });
});
