import { describe, it, expect } from 'vitest';
import { findOptimalYieldRoute, YieldNode } from '../dead-click-router.engine';

describe('Dead Click Router Engine', () => {
  it('returns valid route prioritizing highest EPC - Penalty', () => {
    const nodes: YieldNode[] = [
      { id: 'start', expectedEpc: 1.0, penalty: 0.1, isDead: false, edges: ['a', 'b'] },
      { id: 'a', expectedEpc: 2.0, penalty: 0.5, isDead: false, edges: ['end'] }, // net: 1.5
      { id: 'b', expectedEpc: 3.0, penalty: 1.0, isDead: false, edges: ['end'] }, // net: 2.0
      { id: 'end', expectedEpc: 0, penalty: 0, isDead: false, edges: [] },
    ];

    const result = findOptimalYieldRoute('start', 'end', nodes);

    expect(result.isRoutable).toBe(true);
    // start -> b -> end: (1.0 - 0.1) + (3.0 - 1.0) + (0) = 0.9 + 2.0 = 2.9
    // start -> a -> end: (1.0 - 0.1) + (2.0 - 0.5) + (0) = 0.9 + 1.5 = 2.4
    expect(result.path).toEqual(['start', 'b', 'end']);
    expect(result.totalExpectedEpc).toBe(4.0); // 1.0 + 3.0 + 0
    expect(result.totalPenalty).toBe(1.1);     // 0.1 + 1.0 + 0
  });

  it('avoids dead nodes completely', () => {
    const nodes: YieldNode[] = [
      { id: 'start', expectedEpc: 1.0, penalty: 0, isDead: false, edges: ['a', 'b'] },
      { id: 'a', expectedEpc: 5.0, penalty: 0, isDead: true, edges: ['end'] }, // Very high EPC but dead
      { id: 'b', expectedEpc: 1.0, penalty: 0, isDead: false, edges: ['end'] },
      { id: 'end', expectedEpc: 0, penalty: 0, isDead: false, edges: [] },
    ];

    const result = findOptimalYieldRoute('start', 'end', nodes);

    expect(result.isRoutable).toBe(true);
    expect(result.path).toEqual(['start', 'b', 'end']);
  });

  it('returns false if no route exists', () => {
    const nodes: YieldNode[] = [
      { id: 'start', expectedEpc: 1.0, penalty: 0, isDead: false, edges: ['a'] },
      { id: 'a', expectedEpc: 1.0, penalty: 0, isDead: false, edges: [] }, // dead end
      { id: 'end', expectedEpc: 0, penalty: 0, isDead: false, edges: [] },
    ];

    const result = findOptimalYieldRoute('start', 'end', nodes);
    expect(result.isRoutable).toBe(false);
    expect(result.path).toEqual([]);
  });
});
