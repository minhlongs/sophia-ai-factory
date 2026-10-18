/**
 * Topological Wave Assignment (Kahn's Algorithm) for SOPGraph
 *
 * Layer: tree (domain-reusable, imports seed only)
 */

import type { DAGNode } from '@/seed/types/sop-dag'

/**
 * Build adjacency structures needed for Kahn's algorithm.
 * Returns in-degree map and adjacency list (node → its dependents).
 */
export function buildAdjacency(nodes: DAGNode[]): {
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
export function assignWaves(nodes: DAGNode[]): Map<string, number> {
  const { inDegree, dependents } = buildAdjacency(nodes)
  const waveOf = new Map<string, number>()
  const queue: string[] = []

  // Seed with all zero-in-degree nodes
  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      queue.push(id)
      waveOf.set(id, 0)
    }
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
