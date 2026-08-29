/**
 * Production Factory contracts — multi-agent production graphs.
 *
 * Typed contracts for the autonomous production pipeline: mission-type
 * autonomy policies, production graph definitions (DAG of agent nodes),
 * graph run state, and the Inngest event payloads emitted around runs.
 * Storage lives in migration 0257 (mission_type_policies, production_graphs,
 * production_graph_runs).
 *
 * Layer: seed (foundational — no domain imports).
 *
 * @module seed/types/production-factory
 */

/**
 * Operator-facing autonomy tier for a mission type.
 * L0 manual · L1 assisted · L2 supervised (default) · L3 full auto.
 */
export type AutonomyTier = 0 | 1 | 2 | 3;

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

/**
 * Autonomy policy keyed by (workspace, mission type).
 * Row shape of `mission_type_policies` (migration 0257).
 */
export interface MissionTypePolicy {
  id: string;
  workspaceId: string;
  missionType: string;
  autonomyTier: AutonomyTier;
  requirePublishApproval: boolean;
  /** Budget cap in INTEGER cents; null = no cap. */
  maxCostCentsPerRun: number | null;
  maxAutoRetries: number;
  createdAt: number;
  updatedAt: number;
}

/** A single node in a production graph — one agent run. */
export interface GraphNodeDefinition {
  id: string;
  /** Registered agent slug executed at this node. */
  agentSlug: string;
  name?: string;
  /** Node whose output is published; gated by approval when policy requires. */
  isPublishNode?: boolean;
  inputJson?: Record<string, unknown>;
}

/** Directed edge between two graph nodes. */
export interface GraphEdgeDefinition {
  from: string;
  to: string;
}

/** DAG definition stored in `production_graphs.definition_json`. */
export interface GraphDefinition {
  nodes: GraphNodeDefinition[];
  edges: GraphEdgeDefinition[];
}

/**
 * A production graph template or workspace instance.
 * Row shape of `production_graphs` (migration 0257); `definition` is the
 * parsed form of the stored `definition_json` column.
 */
export interface ProductionGraph {
  id: string;
  workspaceId: string;
  missionType: string;
  slug: string;
  name: string;
  definition: GraphDefinition;
  isTemplate: boolean;
  createdAt: number;
  updatedAt: number;
}

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

/** Payload for `production.graph.started`. */
export type ProductionGraphStartedEvent = {
  data: {
    graphRunId: string;
    graphId: string;
    missionId: string;
    workspaceId: string;
    missionType: string;
    retryCount: number;
    /** When true, run executes with fixed time source and random seed. */
    deterministic?: boolean;
  };
};

/** Payload for `production.graph.completed`. */
export type ProductionGraphCompletedEvent = {
  data: {
    graphRunId: string;
    graphId: string;
    missionId: string;
    workspaceId: string;
    totalCostCents: number;
    totalTokens: number;
  };
};

/** Payload for `production.graph.failed`. */
export type ProductionGraphFailedEvent = {
  data: {
    graphRunId: string;
    graphId: string;
    missionId: string;
    workspaceId: string;
    errorCode: string;
    errorMessage: string;
    retryCount: number;
  };
};

/** Payload for `production.graph.cancelled`. */
export type ProductionGraphCancelledEvent = {
  data: {
    graphRunId: string;
    graphId: string;
    missionId: string;
    workspaceId: string;
    cancelledAt: number;
    reason?: string;
  };
};
