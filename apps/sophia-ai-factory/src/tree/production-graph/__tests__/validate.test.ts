/**
 * Production Graph validation — unit tests.
 * Covers empty graph, duplicate ids, unknown edge nodes, unknown agents,
 * cycle detection, single-sink enforcement, and valid topological order.
 *
 * @module tree/production-graph/__tests__/validate
 */

import { describe, it, expect } from 'vitest';
import type { GraphDefinition } from '@/seed/types/production-factory';
import { validateGraphDefinition } from '../validate';

const SLUGS = new Set(['sophia-researcher', 'sophia-editor', 'sophia-strategist']);

function linearGraph(): GraphDefinition {
  return {
    nodes: [
      { id: 'a', agentSlug: 'sophia-researcher' },
      { id: 'b', agentSlug: 'sophia-editor' },
      { id: 'c', agentSlug: 'sophia-editor', isPublishNode: true },
    ],
    edges: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ],
  };
}

describe('validateGraphDefinition', () => {
  it('accepts a valid linear graph and returns sink + topological order', () => {
    const result = validateGraphDefinition(linearGraph(), SLUGS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sinkIds).toEqual(['c']);
    expect(result.value.topologicalOrder).toEqual(['a', 'b', 'c']);
  });

  it('rejects an empty graph', () => {
    const result = validateGraphDefinition({ nodes: [], edges: [] }, SLUGS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('EMPTY_GRAPH');
  });

  it('rejects duplicate node ids', () => {
    const definition: GraphDefinition = {
      nodes: [
        { id: 'a', agentSlug: 'sophia-researcher' },
        { id: 'a', agentSlug: 'sophia-editor' },
      ],
      edges: [],
    };
    const result = validateGraphDefinition(definition, SLUGS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('DUPLICATE_NODE_ID');
  });

  it('rejects edges referencing unknown nodes', () => {
    const definition: GraphDefinition = {
      nodes: [{ id: 'a', agentSlug: 'sophia-researcher' }],
      edges: [{ from: 'a', to: 'ghost' }],
    };
    const result = validateGraphDefinition(definition, SLUGS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNKNOWN_EDGE_NODE');
  });

  it('rejects unknown agent slugs with node context', () => {
    const definition: GraphDefinition = {
      nodes: [{ id: 'a', agentSlug: 'not-registered' }],
      edges: [],
    };
    const result = validateGraphDefinition(definition, SLUGS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNKNOWN_AGENT');
    if (result.error.code !== 'UNKNOWN_AGENT') return;
    expect(result.error.nodeId).toBe('a');
    expect(result.error.agentSlug).toBe('not-registered');
  });

  it('detects a two-node cycle', () => {
    const definition: GraphDefinition = {
      nodes: [
        { id: 'a', agentSlug: 'sophia-researcher' },
        { id: 'b', agentSlug: 'sophia-editor' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ],
    };
    const result = validateGraphDefinition(definition, SLUGS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CYCLE_DETECTED');
    if (result.error.code !== 'CYCLE_DETECTED') return;
    expect(result.error.cycle.length).toBeGreaterThanOrEqual(3);
    expect(result.error.cycle[0]).toBe(result.error.cycle[result.error.cycle.length - 1]);
  });

  it('detects a self-loop', () => {
    const definition: GraphDefinition = {
      nodes: [{ id: 'a', agentSlug: 'sophia-researcher' }],
      edges: [{ from: 'a', to: 'a' }],
    };
    const result = validateGraphDefinition(definition, SLUGS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CYCLE_DETECTED');
  });

  it('detects a cycle deeper in the graph', () => {
    const definition: GraphDefinition = {
      nodes: [
        { id: 'a', agentSlug: 'sophia-researcher' },
        { id: 'b', agentSlug: 'sophia-editor' },
        { id: 'c', agentSlug: 'sophia-strategist' },
        { id: 'd', agentSlug: 'sophia-editor' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'b' },
        { from: 'c', to: 'd' },
      ],
    };
    const result = validateGraphDefinition(definition, SLUGS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CYCLE_DETECTED');
  });

  it('rejects multiple sinks', () => {
    const definition: GraphDefinition = {
      nodes: [
        { id: 'a', agentSlug: 'sophia-researcher' },
        { id: 'b', agentSlug: 'sophia-editor' },
        { id: 'c', agentSlug: 'sophia-strategist' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'c' },
      ],
    };
    const result = validateGraphDefinition(definition, SLUGS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('MULTIPLE_SINKS');
    if (result.error.code !== 'MULTIPLE_SINKS') return;
    expect(result.error.sinkIds).toEqual(['b', 'c']);
  });

  it('accepts a diamond DAG with a single sink', () => {
    const definition: GraphDefinition = {
      nodes: [
        { id: 'a', agentSlug: 'sophia-researcher' },
        { id: 'b', agentSlug: 'sophia-editor' },
        { id: 'c', agentSlug: 'sophia-strategist' },
        { id: 'd', agentSlug: 'sophia-editor', isPublishNode: true },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'c' },
        { from: 'b', to: 'd' },
        { from: 'c', to: 'd' },
      ],
    };
    const result = validateGraphDefinition(definition, SLUGS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.sinkIds).toEqual(['d']);
    // Topological order must respect all edges.
    const order = result.value.topologicalOrder;
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('d'));
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'));
  });

  it('is deterministic across repeated calls', () => {
    const definition = linearGraph();
    const first = validateGraphDefinition(definition, SLUGS);
    const second = validateGraphDefinition(definition, SLUGS);
    expect(first).toEqual(second);
  });
});
