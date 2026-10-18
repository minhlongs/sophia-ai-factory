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

export type {
  ProductionGraphRunStatus,
  ProductionGraphRunPhase,
  ProductionGraphNodeStatus,
  ProductionGraphNodeState,
  ProductionGraphRunError,
  ProductionGraphRun,
} from './production-factory-runs';

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

export type {
  ProductionGraphStartedEvent,
  ProductionGraphCompletedEvent,
  ProductionGraphFailedEvent,
  ProductionGraphCancelledEvent,
} from './production-factory-events';
