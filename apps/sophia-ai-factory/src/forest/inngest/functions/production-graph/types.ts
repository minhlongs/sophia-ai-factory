/**
 * Production Graph Runner Types and Interfaces.
 *
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * @module forest/inngest/functions/production-graph/types
 */

import type { Result } from '@/seed/types/result';
import type {
  ProductionGraphRun,
  ProductionGraphRunError,
  ProductionGraphRunPhase,
} from '@/seed/types/production-factory';
import type { GraphRepoError } from '@/tree/production-graph/repo';

export const APPROVAL_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24h human review window
export const EXECUTING_PHASE: ProductionGraphRunPhase = 'executing';
export const PUBLISHING_PHASE: ProductionGraphRunPhase = 'publishing';
export const DETERMINISTIC_TIMESTAMP = 1_700_000_000_000; // 2023-11-14 fixed time

/** Failure codes emitted on production.graph.failed. */
export type GraphRunnerErrorCode =
  | 'RUN_NOT_FOUND'
  | 'GRAPH_NOT_FOUND'
  | 'INVALID_GRAPH'
  | 'MISSION_NOT_FOUND'
  | 'BUDGET_EXCEEDED'
  | 'APPROVAL_REJECTED'
  | 'APPROVAL_TIMEOUT'
  | 'NODE_FAILED'
  | 'DB_ERROR'
  | 'CANCELLED';

/** Minimal structural step surface the helpers need. */
export interface EmitStep {
  sendEvent(
    id: string,
    payload:
      | {
          name: 'production.graph.failed';
          data: {
            graphRunId: string;
            graphId: string;
            missionId: string;
            workspaceId: string;
            errorCode: string;
            errorMessage: string;
            retryCount: number;
          };
        }
      | {
          name: 'production.graph.cancelled';
          data: {
            graphRunId: string;
            graphId: string;
            missionId: string;
            workspaceId: string;
            cancelledAt: number;
            reason?: string;
          };
        },
  ): Promise<unknown>;
}

export interface RunnerLogContext {
  graphRunId: string;
  graphId: string;
  missionId: string;
  workspaceId: string;
}

/** Context passed through the execution loop for deterministic mode. */
export interface RunnerContext {
  deterministic: boolean;
  nowMs: () => number;
  getRun: (
    runId: string,
  ) => Promise<Result<ProductionGraphRun | null, GraphRepoError>>;
  graphRunId: string;
}
