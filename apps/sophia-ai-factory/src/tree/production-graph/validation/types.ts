import type { GraphDefinition } from '@/seed/types/production-factory';

/** Validation failure codes — stable contract for callers and tests. */
export type GraphValidationError =
  | { code: 'EMPTY_GRAPH'; message: string }
  | { code: 'DUPLICATE_NODE_ID'; message: string; nodeId: string }
  | { code: 'UNKNOWN_EDGE_NODE'; message: string; edgeFrom: string; edgeTo: string }
  | { code: 'UNKNOWN_AGENT'; message: string; nodeId: string; agentSlug: string }
  | { code: 'CYCLE_DETECTED'; message: string; cycle: string[] }
  | { code: 'MULTIPLE_SINKS'; message: string; sinkIds: string[] }
  | { code: 'NO_SINK'; message: string };

/** Validated graph — the definition plus derived topology the runner needs. */
export interface ValidatedGraph {
  definition: GraphDefinition;
  /** Node ids with no outgoing edges (exactly one after validation). */
  sinkIds: string[];
  /** Topological order of node ids (deterministic: definition order). */
  topologicalOrder: string[];
}
