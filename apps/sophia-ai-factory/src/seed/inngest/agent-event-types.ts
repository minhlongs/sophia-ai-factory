/**
 * Agent-mission event payload types — canonical seed definitions.
 *
 * These five payload contracts back the agent-mission Inngest events
 * (agent.mission.started / approval.requested / approval.resolved /
 * mission.completed / mission.failed). They were merged from the legacy
 * tree client into the seed canonical schema.
 *
 * `AgentMissionStartedData` is the RICH variant: it carries the optional
 * `autonomyLevel` and `inputJson` fields that the real sender
 * (land/creative-mission/actions) emits, so executors no longer need an
 * unsafe cast.
 *
 * Layer: seed (foundational — no domain imports).
 *
 * @module seed/inngest/agent-event-types
 */

/** Payload for `agent.mission.started`. Rich superset — optional autonomy fields. */
export type AgentMissionStartedData = {
  data: {
    runId: string;
    agentId: string;
    missionId: string;
    workspaceId: string;
    autonomyLevel?: number;
    inputJson?: Record<string, unknown>;
  };
};

/** Payload for `agent.approval.requested`. */
export type AgentApprovalRequestedData = {
  data: {
    runId: string;
    approvalId: string;
    actionType: string;
    actionSummary: string;
    missionId: string;
  };
};

/** Payload for `agent.approval.resolved`. */
export type AgentApprovalResolvedData = {
  data: {
    approvalId: string;
    runId: string;
    status: "approved" | "rejected";
    reviewerId: string;
    comment?: string;
  };
};

/** Payload for `agent.mission.completed`. */
export type AgentMissionCompletedData = {
  data: {
    runId: string;
    agentId: string;
    missionId: string;
    totalCostCents: number;
    totalTokens: number;
  };
};

/** Payload for `agent.mission.failed`. */
export type AgentMissionFailedData = {
  data: {
    runId: string;
    agentId: string;
    missionId: string;
    errorCode: string;
    errorMessage: string;
  };
};
