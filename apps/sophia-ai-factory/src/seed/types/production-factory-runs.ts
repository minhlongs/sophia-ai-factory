/**
 * Production Factory Run Contracts — node checkpoints and graph run state.
 *
 * Layer: seed (foundational — no domain imports).
 *
 * @module seed/types/production-factory-runs
 */

/** Lifecycle status of a production graph run. */
export type ProductionGraphRunStatus =
  | 'queued'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Execution phase within a production graph run. */
export type ProductionGraphRunPhase =
  | 'planning'
  | 'executing'
  | 'awaiting_approval'
  | 'publishing'
  | 'review'
  | 'cancelled';

/** Checkpoint status of a single graph node inside a run. */
export type ProductionGraphNodeStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

/** Per-node checkpoint entry persisted in `node_states_json` for resume. */
export interface ProductionGraphNodeState {
  nodeId: string;
  status: ProductionGraphNodeStatus;
  /** Agent run id backing this node, once started. */
  agentRunId?: string;
  outputJson?: string;
  errorMessage?: string;
  startedAt?: number;
  endedAt?: number;
}

/** Structured error persisted in `error_json` of a failed/cancelled run. */
export interface ProductionGraphRunError {
  code: string;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * One execution of a production graph against a mission.
 * Row shape of `production_graph_runs` (migration 0257); JSON columns are
 * exposed parsed (`nodeStates`) or raw (`outputJson`, `errorJson`).
 */
export interface ProductionGraphRun {
  id: string;
  graphId: string;
  missionId: string;
  workspaceId: string;
  status: ProductionGraphRunStatus;
  phase: ProductionGraphRunPhase;
  nodeStates: ProductionGraphNodeState[] | null;
  outputJson: string | null;
  errorJson: string | null;
  errorMessage: string | null;
  /** Accumulated spend in INTEGER cents. */
  totalCostCents: number;
  totalTokens: number;
  retryCount: number;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
}
