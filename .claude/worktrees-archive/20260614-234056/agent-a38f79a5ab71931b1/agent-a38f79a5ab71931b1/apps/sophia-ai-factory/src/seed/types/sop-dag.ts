/**
 * SOP DAG (Directed Acyclic Graph) type definitions.
 * Enables parallel execution of independent SOP steps, reducing latency 50-70%
 * over sequential FSM execution.
 */

/** A node in the SOP execution DAG */
export interface DAGNode {
  id: string
  stepIndex: number
  stepName: string
  /** Mission type to execute (e.g., 'script:generate', 'video:create', 'thumbnail:generate') */
  missionType: string
  /** Input parameters for this step */
  inputParams: Record<string, unknown>
  /** IDs of nodes that must complete before this node can start */
  dependsOn: string[]
  /** Estimated duration in ms (for scheduling optimization) */
  estimatedDurationMs?: number
  /** Estimated cost in cents */
  estimatedCostCents?: number
}

/** An edge in the DAG representing a dependency */
export interface DAGEdge {
  from: string  // source node ID (must complete first)
  to: string    // target node ID (depends on source)
  /** Optional condition for conditional branching */
  condition?: {
    field: string
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains'
    value: unknown
  }
}

/** Complete SOP execution graph */
export interface SOPGraph {
  sopTemplateId: string
  version: number
  nodes: DAGNode[]
  edges: DAGEdge[]
}

/** An execution wave — a set of nodes that can run in parallel */
export interface ExecutionWave {
  waveIndex: number
  nodeIds: string[]
  /** Duration of the wave = max(estimatedDurationMs) across all nodes in wave */
  estimatedDurationMs: number
  /** Cost of the wave = sum(estimatedCostCents) across all nodes in wave */
  estimatedCostCents: number
}

/** Complete execution plan derived from a SOPGraph */
export interface ExecutionPlan {
  sopTemplateId: string
  waves: ExecutionWave[]
  totalEstimatedDurationMs: number
  totalEstimatedCostCents: number
  /** Sum of critical path wave durations */
  criticalPathMs: number
  /** total sequential time / critical path time — measures parallelism benefit */
  parallelismFactor: number
}
