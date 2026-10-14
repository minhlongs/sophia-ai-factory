import type { Result } from '@/seed/types/result';
import { failure, success } from '@/seed/types/result';
import type { GraphDefinition } from '@/seed/types/production-factory';
import type { GraphValidationError, ValidatedGraph } from './types';
import { detectCycle } from './cycle-detector';
import { topologicalSort } from './topological-sorter';

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
