/**
 * Parallel Planner — analyzes a SOPGraph and produces an ExecutionPlan with parallel waves.
 * Uses Kahn's topological sort algorithm to identify nodes that can execute simultaneously.
 *
 * Layer: tree (domain-reusable, imports seed only)
 */

import type { SOPGraph, ExecutionPlan, ExecutionWave, DAGNode } from '@/seed/types/sop-dag'
import { assignWaves } from './parallel-planner-waves'

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

  // Detect cycle: nodes not assigned a wave
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
