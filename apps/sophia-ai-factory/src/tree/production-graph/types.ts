/**
 * Production Graph — type surface for the tree layer.
 *
 * Re-exports the canonical seed contracts (Lane A) and adds the runtime
 * node-state types the graph engine operates on. Tree layer may only import
 * from seed — no forest/land imports here.
 *
 * @module tree/production-graph/types
 */

export type {
  AutonomyTier,
  GraphDefinition,
  GraphEdgeDefinition,
  GraphNodeDefinition,
  ProductionGraph,
  ProductionGraphCompletedEvent,
  ProductionGraphFailedEvent,
  ProductionGraphNodeState,
  ProductionGraphNodeStatus,
  ProductionGraphRun,
  ProductionGraphRunError,
  ProductionGraphRunPhase,
  ProductionGraphRunStatus,
  ProductionGraphStartedEvent,
} from '@/seed/types/production-factory';

import type {
  GraphNodeDefinition,
  ProductionGraphNodeState,
  ProductionGraphNodeStatus,
} from '@/seed/types/production-factory';

/**
 * Runtime state of a single graph node during execution.
 * Wraps the persisted node state with the node definition so the runner can
 * schedule without re-looking-up the graph definition.
 */
export interface GraphNodeRuntimeState {
  /** Node definition from the graph. */
  node: GraphNodeDefinition;
  /** Current execution status. */
  status: ProductionGraphNodeStatus;
  /** Agent run id once the node has started executing. */
  agentRunId?: string;
  /** Serialized node output (JSON string) once completed. */
  outputJson?: string;
  /** Failure reason when status is 'failed'. */
  errorMessage?: string;
  /** Epoch ms when the node started. */
  startedAt?: number;
  /** Epoch ms when the node ended (completed/failed/skipped). */
  endedAt?: number;
}

/**
 * Build the initial runtime state map for a graph: every node starts pending.
 * Pure and deterministic — same definition in, same map out.
 */
export function buildInitialNodeStates(
  nodes: readonly GraphNodeDefinition[],
): Map<string, GraphNodeRuntimeState> {
  const map = new Map<string, GraphNodeRuntimeState>();
  for (const node of nodes) {
    map.set(node.id, { node, status: 'pending' });
  }
  return map;
}

/**
 * Hydrate runtime states from persisted node states (resume path).
 * Nodes missing from the persisted list default to 'pending'.
 */
export function hydrateNodeStates(
  nodes: readonly GraphNodeDefinition[],
  persisted: readonly ProductionGraphNodeState[] | null,
): Map<string, GraphNodeRuntimeState> {
  const map = buildInitialNodeStates(nodes);
  if (!persisted) return map;
  for (const state of persisted) {
    const runtime = map.get(state.nodeId);
    if (!runtime) continue;
    runtime.status = state.status;
    runtime.agentRunId = state.agentRunId;
    runtime.outputJson = state.outputJson;
    runtime.errorMessage = state.errorMessage;
    runtime.startedAt = state.startedAt;
    runtime.endedAt = state.endedAt;
  }
  return map;
}

/**
 * Serialize runtime states back to the persisted shape for storage.
 */
export function serializeNodeStates(
  states: ReadonlyMap<string, GraphNodeRuntimeState>,
): ProductionGraphNodeState[] {
  return Array.from(states.values()).map((state) => ({
    nodeId: state.node.id,
    status: state.status,
    agentRunId: state.agentRunId,
    outputJson: state.outputJson,
    errorMessage: state.errorMessage,
    startedAt: state.startedAt,
    endedAt: state.endedAt,
  }));
}
