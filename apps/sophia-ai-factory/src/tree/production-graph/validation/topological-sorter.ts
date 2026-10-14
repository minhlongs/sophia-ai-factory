import { buildAdjacency } from './cycle-detector';

/**
 * Kahn's algorithm topological sort. Deterministic: ties broken by
 * definition order of node ids. Assumes the graph is acyclic.
 */
export function topologicalSort(
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
