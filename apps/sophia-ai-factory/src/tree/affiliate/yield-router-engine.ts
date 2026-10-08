export type YieldNode = {
  id: string;
  isDead: boolean;
};

export type YieldEdge = {
  from: string;
  to: string;
  epc: number;     // Earnings per click
  penalty: number; // Penalty / cost
};

export type YieldGraph = {
  nodes: YieldNode[];
  edges: YieldEdge[];
};

export type YieldRouteResult = {
  path: string[];
  maxNetYield: number;
};

/**
 * Finds the optimal path in a DAG from startNode to any valid leaf node
 * or a specific endNode to maximize (epc - penalty), avoiding dead nodes.
 */
export function calculateOptimalYieldRoute(
  graph: YieldGraph,
  startNodeId: string,
  endNodeId: string
): YieldRouteResult | null {
  const deadNodes = new Set(graph.nodes.filter((n) => n.isDead).map((n) => n.id));

  if (deadNodes.has(startNodeId) || deadNodes.has(endNodeId)) {
    return null;
  }

  // Adjacency list
  const adj = new Map<string, YieldEdge[]>();
  for (const node of graph.nodes) {
    adj.set(node.id, []);
  }

  for (const edge of graph.edges) {
    if (!deadNodes.has(edge.from) && !deadNodes.has(edge.to)) {
      adj.get(edge.from)?.push(edge);
    }
  }

  // To find highest net yield (epc - penalty), we can use a modified Dijkstra (if DAG)
  // or a simple Bellman-Ford/BFS if it's a DAG or has no positive cycles.
  // Assuming a DAG for "routing" funnels.
  // Let's do a simple Bellman-Ford or topological sort based longest path.
  // For simplicity and since paths are short in affiliate funnels, we'll use a dynamic programming approach with topological sort, or simply a queue-based path exploration since it's a DAG.

  const dist = new Map<string, number>();
  const prev = new Map<string, string>();

  for (const node of graph.nodes) {
    dist.set(node.id, -Infinity);
  }

  dist.set(startNodeId, 0);

  // Simple BFS topological traversal (assuming no cycles for a funnel)
  const edges = graph.edges.filter(
    (e) => !deadNodes.has(e.from) && !deadNodes.has(e.to)
  );

  // Bellman-ford to handle highest path in DAG/graph without positive infinite cycles.
  // V-1 iterations
  const V = graph.nodes.length;
  for (let i = 0; i < V - 1; i++) {
    let updated = false;
    for (const edge of edges) {
      const u = edge.from;
      const v = edge.to;
      const weight = edge.epc - edge.penalty;

      const currentDistU = dist.get(u) ?? -Infinity;
      const currentDistV = dist.get(v) ?? -Infinity;

      if (currentDistU !== -Infinity && currentDistU + weight > currentDistV) {
        dist.set(v, currentDistU + weight);
        prev.set(v, u);
        updated = true;
      }
    }
    if (!updated) break;
  }

  if (dist.get(endNodeId) === -Infinity) {
    return null;
  }

  // Reconstruct path
  const path: string[] = [];
  let curr = endNodeId;
  while (curr !== startNodeId) {
    path.push(curr);
    curr = prev.get(curr)!;
  }
  path.push(startNodeId);
  path.reverse();

  return {
    path,
    maxNetYield: dist.get(endNodeId)!
  };
}
