import { describe, it, expect } from 'vitest';
import {
  calculateOptimalYieldRoute,
  YieldGraph,
} from '../yield-router-engine';

describe('yield-router-engine', () => {
  it('should find the optimal yield route', () => {
    const graph: YieldGraph = {
      nodes: [
        { id: 'A', isDead: false },
        { id: 'B', isDead: false },
        { id: 'C', isDead: false },
        { id: 'D', isDead: false },
      ],
      edges: [
        { from: 'A', to: 'B', epc: 10, penalty: 2 }, // net 8
        { from: 'A', to: 'C', epc: 5, penalty: 1 },  // net 4
        { from: 'B', to: 'D', epc: 15, penalty: 5 }, // net 10 => A->B->D = 18
        { from: 'C', to: 'D', epc: 20, penalty: 2 }, // net 18 => A->C->D = 22
      ],
    };

    const result = calculateOptimalYieldRoute(graph, 'A', 'D');
    expect(result).not.toBeNull();
    expect(result?.maxNetYield).toBe(22);
    expect(result?.path).toEqual(['A', 'C', 'D']);
  });

  it('should avoid dead nodes completely', () => {
    const graph: YieldGraph = {
      nodes: [
        { id: 'A', isDead: false },
        { id: 'B', isDead: false },
        { id: 'C', isDead: true },
        { id: 'D', isDead: false },
      ],
      edges: [
        { from: 'A', to: 'B', epc: 10, penalty: 2 },
        { from: 'A', to: 'C', epc: 50, penalty: 1 },
        { from: 'B', to: 'D', epc: 15, penalty: 5 },
        { from: 'C', to: 'D', epc: 20, penalty: 2 },
      ],
    };

    const result = calculateOptimalYieldRoute(graph, 'A', 'D');
    expect(result).not.toBeNull();
    expect(result?.maxNetYield).toBe(18); // A -> B -> D
    expect(result?.path).toEqual(['A', 'B', 'D']);
  });

  it('should return null if start or end is dead', () => {
    const graph: YieldGraph = {
      nodes: [
        { id: 'A', isDead: true },
        { id: 'B', isDead: false },
      ],
      edges: [{ from: 'A', to: 'B', epc: 10, penalty: 2 }],
    };
    expect(calculateOptimalYieldRoute(graph, 'A', 'B')).toBeNull();
  });

  it('should return null if no path exists', () => {
    const graph: YieldGraph = {
      nodes: [
        { id: 'A', isDead: false },
        { id: 'B', isDead: false },
      ],
      edges: [],
    };
    expect(calculateOptimalYieldRoute(graph, 'A', 'B')).toBeNull();
  });
});
