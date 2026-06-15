/**
 * Parallel Planner — analyzes a SOPGraph and produces an ExecutionPlan with parallel waves.
 * Uses Kahn's topological sort algorithm to identify nodes that can execute simultaneously.
 *
 * Layer: tree (domain-reusable, imports seed only)
 */

import type { SOPGraph, ExecutionPlan, ExecutionWave, DAGNode } from '@/seed/types/sop-dag'

/**
 * Build adjacency structures needed for Kahn's algorithm.
 * Returns in-degree map and adjacency list (node → its dependents).
 */
function buildAdjacency(nodes: DAGNode[]): {
  inDegree: Map<string, number>
  dependents: Map<string, string[]>
} {
  const inDegree = new Map<string, number>()
  const dependents = new Map<string, string[]>()

  for (const node of nodes) {
    if (!inDegree.has(node.id)) inDegree.set(node.id, 0)
    if (!dependents.has(node.id)) dependents.set(node.id, [])
  }

  for (const node of nodes) {
    for (const depId of node.dependsOn) {
      inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1)
      const list = dependents.get(depId) ?? []
      list.push(node.id)
      dependents.set(depId, list)
    }
  }

  return { inDegree, dependents }
}

/**
 * Assign each node to an execution wave via topological BFS.
 * Wave 0 = nodes with no dependencies; wave N = nodes whose all deps are in waves < N.
 */
function assignWaves(nodes: DAGNode[]): Map<string, number> {
  const { inDegree, dependents } = buildAdjacency(nodes)
  const waveOf = new Map<string, number>()
  const queue: string[] = []

  // Seed with all zero-in-degree nodes
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  while (queue.length > 0) {
    const id = queue.shift()!
    const currentWave = waveOf.get(id) ?? 0

    for (const dependentId of (dependents.get(id) ?? [])) {
      // A dependent's wave = max(its deps' waves) + 1
      const nextWave = currentWave + 1
      const existing = waveOf.get(dependentId) ?? 0
      waveOf.set(dependentId, Math.max(existing, nextWave))

      const newDeg = (inDegree.get(dependentId) ?? 1) - 1
      inDegree.set(dependentId, newDeg)
      if (newDeg === 0) queue.push(dependentId)
    }
  }

  return waveOf
}

/**
 * Analyze a SOPGraph and produce an ExecutionPlan with parallel waves.
 *
 * Algorithm (Kahn's topological sort + wave grouping):
 * 1. Build in-degree map and adjacency list from node.dependsOn arrays
 * 2. BFS assigns each node its wave number (max(deps' wave) + 1)
 * 3. Group nodes by wave; calculate per-wave estimates
 * 4. Derive critical path (sum of wave durations), parallelism factor
 *
 * @throws Error if the graph contains a cycle (detected by unreachable nodes)
 */
export function planExecution(graph: SOPGraph): ExecutionPlan {
  if (graph.nodes.length === 0) {
    return {
      sopTemplateId: graph.sopTemplateId,
      waves: [],
      totalEstimatedDurationMs: 0,
      totalEstimatedCostCents: 0,
      criticalPathMs: 0,
      parallelismFactor: 1,
    }
  }

  const waveOf = assignWaves(graph.nodes)

  // Detect cycle: any node not assigned a wave
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))
  for (const node of graph.nodes) {
    if (!waveOf.has(node.id)) {
      throw new Error(
        `SOPGraph cycle detected: node "${node.id}" is unreachable via topological sort`,
      )
    }
  }

  // Group nodes into waves
  const waveCount = Math.max(...waveOf.values()) + 1
  const waveGroups: DAGNode[][] = Array.from({ length: waveCount }, () => [])
  for (const [id, waveIdx] of waveOf) {
    const node = nodeById.get(id)
    if (node) waveGroups[waveIdx].push(node)
  }

  // Build ExecutionWave objects
  const waves: ExecutionWave[] = waveGroups.map((nodesInWave, waveIndex) => {
    const maxDuration = Math.max(
      0,
      ...nodesInWave.map(n => n.estimatedDurationMs ?? 0),
    )
    const totalCost = nodesInWave.reduce(
      (sum, n) => sum + (n.estimatedCostCents ?? 0),
      0,
    )
    return {
      waveIndex,
      nodeIds: nodesInWave.map(n => n.id),
      estimatedDurationMs: maxDuration,
      estimatedCostCents: totalCost,
    }
  })

  const criticalPathMs = waves.reduce((sum, w) => sum + w.estimatedDurationMs, 0)
  const totalEstimatedCostCents = waves.reduce((sum, w) => sum + w.estimatedCostCents, 0)

  // Sequential total = sum of every node's duration individually
  const sequentialTotalMs = graph.nodes.reduce(
    (sum, n) => sum + (n.estimatedDurationMs ?? 0),
    0,
  )
  const parallelismFactor =
    criticalPathMs > 0 ? sequentialTotalMs / criticalPathMs : 1

  return {
    sopTemplateId: graph.sopTemplateId,
    waves,
    totalEstimatedDurationMs: criticalPathMs,
    totalEstimatedCostCents,
    criticalPathMs,
    parallelismFactor,
  }
}
