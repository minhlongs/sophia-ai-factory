/**
 * @file dead-click-router.engine.ts
 * @description Zero-IO mathematical engine for calculating optimal affiliate yield routes
 * @layer tree
 */

export interface YieldNode {
  id: string;
  expectedEpc: number; // Expected earnings per click
  isDead: boolean;     // If true, node cannot be traversed
  penalty: number;     // Routing penalty or traffic leakage
  edges: string[];     // Dest node IDs
}

export interface RouteResult {
  path: string[];
  totalExpectedEpc: number;
  totalPenalty: number;
  isRoutable: boolean;
}

/**
 * Calculates the optimal path in a DAG of affiliate links maximizing total EPC and minimizing penalty.
 * Modifies Dijkstra's/A* approach since we want to MAXIMIZE EPC minus penalty.
 * For simplicity, we just run a BFS/DFS or topological sort if DAG, but doing a robust DFS with memoization
 * to find the path that maximizes `node.expectedEpc - node.penalty` accumulating.
 */
export function findOptimalYieldRoute(
  startNodeId: string,
  endNodeId: string,
  nodes: YieldNode[]
): RouteResult {
  const nodeMap = new Map<string, YieldNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // To prevent infinite loops in cyclic graphs (though stated as DAG, play it safe)
  const visited = new Set<string>();

  let bestPath: string[] = [];
  let maxScore = -Infinity;
  let finalEpc = 0;
  let finalPenalty = 0;

  function dfs(currentId: string, path: string[], currentScore: number, currentEpc: number, currentPenalty: number) {
    const node = nodeMap.get(currentId);
    if (!node || node.isDead || visited.has(currentId)) return;

    // We reached the destination
    if (currentId === endNodeId) {
      if (currentScore > maxScore) {
        maxScore = currentScore;
        bestPath = [...path, currentId];
        finalEpc = currentEpc;
        finalPenalty = currentPenalty;
      }
      return;
    }

    visited.add(currentId);
    path.push(currentId);

    for (const edge of node.edges) {
      const neighbor = nodeMap.get(edge);
      if (neighbor && !neighbor.isDead) {
        const edgeScore = neighbor.expectedEpc - neighbor.penalty;
        dfs(
          edge,
          path,
          currentScore + edgeScore,
          currentEpc + neighbor.expectedEpc,
          currentPenalty + neighbor.penalty
        );
      }
    }

    path.pop();
    visited.delete(currentId);
  }

  const startNode = nodeMap.get(startNodeId);
  if (!startNode || startNode.isDead) {
    return { path: [], totalExpectedEpc: 0, totalPenalty: 0, isRoutable: false };
  }

  const initialScore = startNode.expectedEpc - startNode.penalty;
  dfs(startNodeId, [], initialScore, startNode.expectedEpc, startNode.penalty);

  if (bestPath.length === 0) {
    return { path: [], totalExpectedEpc: 0, totalPenalty: 0, isRoutable: false };
  }

  return {
    path: bestPath,
    totalExpectedEpc: finalEpc,
    totalPenalty: finalPenalty,
    isRoutable: true,
  };
}
