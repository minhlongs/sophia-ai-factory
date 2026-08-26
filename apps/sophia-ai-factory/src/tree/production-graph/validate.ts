/**
 * Production Graph — pure definition validation.
 *
 * Deterministic, side-effect-free validation of a GraphDefinition before it
 * is persisted or executed. Rejects: empty graphs, duplicate node ids,
 * edges referencing unknown nodes, unknown agent slugs, cycles (DFS), and
 * graphs without exactly one sink (a node with no outgoing edges).
 *
 * @module tree/production-graph/validate
 */

import type { Result } from '@/seed/types/result';
import { failure, success } from '@/seed/types/result';
import type { GraphDefinition } from '@/seed/types/production-factory';

/** Validation failure codes — stable contract for callers and tests. */
export type GraphValidationError =
  | { code: 'EMPTY_GRAPH'; message: string }
  | { code: 'DUPLICATE_NODE_ID'; message: string; nodeId: string }
  | { code: 'UNKNOWN_EDGE_NODE'; message: string; edgeFrom: string; edgeTo: string }
  | { code: 'UNKNOWN_AGENT'; message: string; nodeId: string; agentSlug: string }
  | { code: 'CYCLE_DETECTED'; message: string; cycle: string[] }
  | { code: 'MULTIPLE_SINKS'; message: string; sinkIds: string[] }
  | { code: 'NO_SINK'; message: string };

/** Validated graph — the definition plus derived topology the runner needs. */
export interface ValidatedGraph {
  definition: GraphDefinition;
  /** Node ids with no outgoing edges (exactly one after validation). */
  sinkIds: string[];
  /** Topological order of node ids (deterministic: definition order). */
  topologicalOrder: string[];
}

/**
 * Validate a graph definition against the set of known agent slugs.
 * Pure and deterministic — same inputs always produce the same result.
 */
export function validateGraphDefinition(
  definition: GraphDefinition,
  knownAgentSlugs: ReadonlySet<string>,
): Result<ValidatedGraph, GraphValidationError> {
  const { nodes, edges } = definition;

  if (nodes.length === 0) {
    return failure({
      code: 'EMPTY_GRAPH',
      message: 'Graph definition has no nodes',
    });
  }

  // Duplicate node ids.
  const seen = new Set<string>();
  for (const node of nodes) {
    if (seen.has(node.id)) {
      return failure({
        code: 'DUPLICATE_NODE_ID',
        message: `Duplicate node id: ${node.id}`,
        nodeId: node.id,
      });
    }
    seen.add(node.id);
  }

  // Edges must reference existing nodes.
  for (const edge of edges) {
    if (!seen.has(edge.from) || !seen.has(edge.to)) {
      return failure({
        code: 'UNKNOWN_EDGE_NODE',
        message: `Edge references unknown node: ${edge.from} -> ${edge.to}`,
        edgeFrom: edge.from,
        edgeTo: edge.to,
      });
    }
  }

  // Every node's agent slug must be registered.
  for (const node of nodes) {
    if (!knownAgentSlugs.has(node.agentSlug)) {
      return failure({
        code: 'UNKNOWN_AGENT',
        message: `Node ${node.id} references unknown agent slug: ${node.agentSlug}`,
        nodeId: node.id,
        agentSlug: node.agentSlug,
      });
    }
  }

  // Cycle detection via iterative DFS with three-color marking.
  const cycle = detectCycle(nodes.map((n) => n.id), edges);
  if (cycle) {
    return failure({
      code: 'CYCLE_DETECTED',
      message: `Graph contains a cycle: ${cycle.join(' -> ')}`,
      cycle,
    });
  }

  // Single-sink enforcement: exactly one node with no outgoing edges.
  const hasOutgoing = new Set<string>();
  for (const edge of edges) {
    hasOutgoing.add(edge.from);
  }
  const sinkIds = nodes.map((n) => n.id).filter((id) => !hasOutgoing.has(id));
  if (sinkIds.length === 0) {
    return failure({
      code: 'NO_SINK',
      message: 'Graph has no sink node (every node has an outgoing edge)',
    });
  }
  if (sinkIds.length > 1) {
    return failure({
      code: 'MULTIPLE_SINKS',
      message: `Graph has ${sinkIds.length} sink nodes: ${sinkIds.join(', ')}`,
      sinkIds,
    });
  }

  return success({
    definition,
    sinkIds,
    topologicalOrder: topologicalSort(nodes.map((n) => n.id), edges),
  });
}

/**
 * Iterative DFS cycle detection. Returns the cycle path when found,
 * null when the graph is acyclic. Deterministic: visits nodes and
 * adjacency lists in definition order.
 */
function detectCycle(
  nodeIds: string[],
  edges: readonly { from: string; to: string }[],
): string[] | null {
  const adjacency = buildAdjacency(edges);
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of nodeIds) color.set(id, WHITE);

  for (const start of nodeIds) {
    if (color.get(start) !== WHITE) continue;
    // Stack frames: [nodeId, index into adjacency list].
    const stack: Array<{ id: string; index: number }> = [{ id: start, index: 0 }];
    color.set(start, GRAY);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const neighbors = adjacency.get(frame.id) ?? [];
      if (frame.index < neighbors.length) {
        const next = neighbors[frame.index];
        frame.index += 1;
        const nextColor = color.get(next);
        if (nextColor === GRAY) {
          // Back edge — reconstruct the cycle from the current stack.
          const cycleStart = stack.findIndex((f) => f.id === next);
          const path = stack.slice(cycleStart).map((f) => f.id);
          path.push(next);
          return path;
        }
        if (nextColor === WHITE) {
          color.set(next, GRAY);
          stack.push({ id: next, index: 0 });
        }
      } else {
        color.set(frame.id, BLACK);
        stack.pop();
      }
    }
  }
  return null;
}

/**
 * Kahn's algorithm topological sort. Deterministic: ties broken by
 * definition order of node ids. Assumes the graph is acyclic.
 */
function topologicalSort(
  nodeIds: string[],
  edges: readonly { from: string; to: string }[],
): string[] {
  const adjacency = buildAdjacency(edges);
  const inDegree = new Map<string, number>();
  for (const id of nodeIds) inDegree.set(id, 0);
  for (const edge of edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  const ready = nodeIds.filter((id) => (inDegree.get(id) ?? 0) === 0);
  const order: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift();
    if (id === undefined) break;
    order.push(id);
    for (const next of adjacency.get(id) ?? []) {
      const remaining = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, remaining);
      if (remaining === 0) ready.push(next);
    }
  }
  return order;
}

function buildAdjacency(
  edges: readonly { from: string; to: string }[],
): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.from);
    if (list) list.push(edge.to);
    else adjacency.set(edge.from, [edge.to]);
  }
  return adjacency;
}
