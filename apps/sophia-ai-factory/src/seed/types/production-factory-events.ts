/**
 * Inngest Event Payloads for Production Graph Runs
 * @module seed/types/production-factory-events
 */

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
