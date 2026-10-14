export function buildAdjacency(
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

function dfsExploreFromNode(
  start: string,
  adjacency: Map<string, string[]>,
  color: Map<string, number>,
): string[] | null {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
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
  return null;
}

/**
 * Iterative DFS cycle detection. Returns the cycle path when found,
 * null when the graph is acyclic. Deterministic: visits nodes and
 * adjacency lists in definition order.
 */
export function detectCycle(
  nodeIds: string[],
  edges: readonly { from: string; to: string }[],
): string[] | null {
  const adjacency = buildAdjacency(edges);
  const WHITE = 0;
  const color = new Map<string, number>();
  for (const id of nodeIds) color.set(id, WHITE);

  for (const start of nodeIds) {
    if (color.get(start) !== WHITE) continue;
    const cycle = dfsExploreFromNode(start, adjacency, color);
    if (cycle) return cycle;
  }
  return null;
}
