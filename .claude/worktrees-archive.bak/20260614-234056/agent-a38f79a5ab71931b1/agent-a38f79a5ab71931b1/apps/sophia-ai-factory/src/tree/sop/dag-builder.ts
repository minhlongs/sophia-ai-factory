/**
 * DAG Builder — converts a linear SOP step list into a dependency graph.
 * Analyzes dependsOnOutputs to detect parallelism opportunities.
 *
 * Layer: tree (domain-reusable, imports seed only)
 */

import type { DAGNode, DAGEdge, SOPGraph } from '@/seed/types/sop-dag'

/**
 * A single step in a linear SOP definition.
 * Steps are authored sequentially; this builder detects actual dependency edges.
 */
export interface LinearStep {
  stepName: string
  missionType: string
  inputParams: Record<string, unknown>
  /**
   * Output field keys from prior steps that this step consumes.
   * Format: "<stepIndex>.<fieldName>" e.g. "0.scriptContent", "1.audioUrl"
   * If omitted, step conservatively depends on ALL prior steps.
   */
  dependsOnOutputs?: string[]
  estimatedDurationMs?: number
  estimatedCostCents?: number
}

/**
 * Parse a dependsOnOutputs reference to extract the step index.
 * References use the convention "<stepIndex>.<fieldName>".
 * Returns null if the reference cannot be parsed.
 */
function parseStepIndexFromRef(ref: string): number | null {
  const dotIdx = ref.indexOf('.')
  if (dotIdx <= 0) return null
  const parsed = parseInt(ref.slice(0, dotIdx), 10)
  return isNaN(parsed) ? null : parsed
}

/**
 * Convert a linear list of SOP steps into a SOPGraph with detected parallelism.
 *
 * Dependency detection logic:
 * - If a step declares `dependsOnOutputs`, edges are created only for the
 *   referenced prior steps (fine-grained parallelism).
 * - If a step has NO `dependsOnOutputs`, it conservatively depends on ALL
 *   prior steps (safe default, equivalent to sequential execution).
 *
 * @param sopTemplateId - Identifies the SOP template this graph belongs to
 * @param steps - Ordered list of linear steps
 * @param version - Graph schema version (default 1)
 */
export function buildSOPGraph(
  sopTemplateId: string,
  steps: LinearStep[],
  version = 1,
): SOPGraph {
  const nodes: DAGNode[] = []
  const edges: DAGEdge[] = []

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const nodeId = `step_${i}`
    const dependsOn: string[] = []

    if (step.dependsOnOutputs && step.dependsOnOutputs.length > 0) {
      // Fine-grained: only depend on steps explicitly referenced
      const seen = new Set<number>()
      for (const ref of step.dependsOnOutputs) {
        const refIdx = parseStepIndexFromRef(ref)
        if (refIdx !== null && refIdx >= 0 && refIdx < i && !seen.has(refIdx)) {
          seen.add(refIdx)
          const fromId = `step_${refIdx}`
          dependsOn.push(fromId)
          edges.push({ from: fromId, to: nodeId })
        }
      }
    } else if (i > 0) {
      // Conservative default: depend on ALL prior steps
      for (let prev = 0; prev < i; prev++) {
        const fromId = `step_${prev}`
        dependsOn.push(fromId)
        edges.push({ from: fromId, to: nodeId })
      }
    }

    nodes.push({
      id: nodeId,
      stepIndex: i,
      stepName: step.stepName,
      missionType: step.missionType,
      inputParams: step.inputParams,
      dependsOn,
      estimatedDurationMs: step.estimatedDurationMs,
      estimatedCostCents: step.estimatedCostCents,
    })
  }

  return { sopTemplateId, version, nodes, edges }
}
