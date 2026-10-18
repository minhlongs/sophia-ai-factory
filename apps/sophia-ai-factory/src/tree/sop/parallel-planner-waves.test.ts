import { describe, expect, it } from 'vitest';
import type { DAGNode } from '@/seed/types/sop-dag';
import { assignWaves, buildAdjacency } from './parallel-planner-waves';

function node(id: string, dependsOn: string[] = []): DAGNode {
  return { id, stepIndex: 0, stepName: id, missionType: 'test', inputParams: {}, dependsOn };
}

describe('buildAdjacency', () => {
  it('initializes all node degrees and records dependent edges', () => {
    const result = buildAdjacency([
      node('draft'), node('script', ['draft']), node('video', ['draft', 'script']),
    ]);
    expect([...result.inDegree.entries()]).toEqual([['draft', 0], ['script', 1], ['video', 2]]);
    expect([...result.dependents.entries()]).toEqual([
      ['draft', ['script', 'video']], ['script', ['video']], ['video', []],
    ]);
  });

  it('supports empty input and preserves edges to missing dependency IDs', () => {
    expect(buildAdjacency([])).toEqual({ inDegree: new Map(), dependents: new Map() });
    const result = buildAdjacency([node('orphan', ['missing'])]);
    expect(result.inDegree.get('orphan')).toBe(1);
    expect(result.dependents.get('missing')).toEqual(['orphan']);
  });
});

describe('assignWaves', () => {
  it('assigns roots together and places dependents after all prerequisite waves', () => {
    const waves = assignWaves([
      node('short-root'),
      node('long-root'),
      node('long-middle', ['long-root']),
      node('long-leaf', ['long-middle']),
      node('join', ['short-root', 'long-leaf']),
      node('independent'),
    ]);
    expect(Object.fromEntries(waves)).toEqual({
      'short-root': 0, 'long-root': 0, independent: 0,
      'long-middle': 1, 'long-leaf': 2, join: 3,
    });
  });

  it('keeps nodes outside a cycle schedulable and returns no waves for a fully cyclic graph', () => {
    expect(assignWaves([
      node('a', ['b']), node('b', ['a']), node('ready'),
    ])).toEqual(new Map([['ready', 0]]));
    expect(assignWaves([node('x', ['y']), node('y', ['x'])])).toEqual(new Map());
  });

  it('returns an empty map for an empty plan', () => {
    expect(assignWaves([])).toEqual(new Map());
  });
});
