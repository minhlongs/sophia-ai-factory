/**
 * Reality Loop v1 — mission + agent + approval emitters (Phase C).
 *
 * Layer: tree (domain-specific reusable). Imports seed only.
 * Side-channel, non-fatal, idempotent writes into the EXISTING
 * `performance_events` table via `recordPerformanceEventIdempotent`.
 * Privacy: metrics payload = IDs, enums, counts, cents, durations only.
 *
 * @module tree/performance/loop-emitters-runner
 */

import { emitLoopEvent, type LoopEventContext, type AutonomyFailureClass } from './loop-events';

/**
 * Q9/Q10 — mission funnel entry. Fires once at mission creation.
 * Answers: "how many missions enter the system?" (denominator for completion + abandonment).
 */
export async function emitMissionCreated(args: LoopEventContext & {
  missionId: string;
  autonomyLevel: number;
  budgetCents: number;
}): Promise<boolean> {
  return emitLoopEvent('mission.created', {
    workspaceId: args.workspaceId,
    entityId: args.missionId,
    recordedAt: args.recordedAt,
    channel: 'mission',
    metrics: { autonomy_level: args.autonomyLevel, budget_cents: args.budgetCents },
  });
}

/**
 * Q8 — mission created but never started (abandoned). Fires when a mission
 * transitions to a terminal-abandoned state without ever running a node.
 */
export async function emitMissionAbandoned(args: LoopEventContext & {
  missionId: string;
  reason: string;
  stage: string;
}): Promise<boolean> {
  return emitLoopEvent('mission.abandoned', {
    workspaceId: args.workspaceId,
    entityId: args.missionId,
    recordedAt: args.recordedAt,
    channel: 'mission',
    metrics: { reason: args.reason, stage: args.stage },
  });
}

/**
 * Q7/Q8 — agent node execution started. Mirrors recordNodePerformance placement
 * (post-node, side-channel). Answers: "where does the machine begin work?".
 */
export async function emitAgentStarted(args: LoopEventContext & {
  missionId: string;
  graphRunId: string;
  nodeId: string;
  agentSlug: string;
  agentRunId: string;
}): Promise<boolean> {
  return emitLoopEvent('agent.started', {
    workspaceId: args.workspaceId,
    entityId: args.missionId,
    recordedAt: args.recordedAt,
    channel: 'agent',
    metrics: {
      graph_run_id: args.graphRunId,
      node_id: args.nodeId,
      agent_slug: args.agentSlug,
      agent_run_id: args.agentRunId,
    },
  });
}

/**
 * Q7 — agent node execution failed. Classifies the failure into the 12-class
 * taxonomy (Phase G) and records the class. Answers: "where does autonomy break?".
 */
export async function emitAgentFailed(args: LoopEventContext & {
  missionId: string;
  graphRunId: string;
  nodeId: string;
  agentSlug: string;
  agentRunId: string;
  errorCode: string;
  errorMessage: string;
  failureClass: AutonomyFailureClass;
  costCents: number;
  totalTokens: number;
  durationMs: number;
}): Promise<boolean> {
  return emitLoopEvent('agent.failed', {
    workspaceId: args.workspaceId,
    entityId: args.missionId,
    recordedAt: args.recordedAt,
    channel: 'agent',
    valueCents: args.costCents,
    metrics: {
      graph_run_id: args.graphRunId,
      node_id: args.nodeId,
      agent_slug: args.agentSlug,
      agent_run_id: args.agentRunId,
      error_code: args.errorCode,
      failure_class: args.failureClass,
      total_tokens: args.totalTokens,
      duration_ms: args.durationMs,
    },
  });
}

/**
 * Q2/Q6 — human approval requested. Fires when the approval gate suspends the run.
 * Answers: "where does the human get asked?".
 */
export async function emitApprovalRequested(args: LoopEventContext & {
  missionId: string;
  graphRunId: string;
  nodeId: string;
  approvalId: string;
  actionType: string;
}): Promise<boolean> {
  return emitLoopEvent('approval.requested', {
    workspaceId: args.workspaceId,
    entityId: args.missionId,
    recordedAt: args.recordedAt,
    channel: 'approval',
    metrics: {
      graph_run_id: args.graphRunId,
      node_id: args.nodeId,
      approval_id: args.approvalId,
      action_type: args.actionType,
    },
  });
}

/**
 * Q2/Q6 — human approved. Fires when the gate resolves to approved/skipped.
 * Answers: "how long did human review take?" (paired with requested timestamp).
 */
export async function emitApprovalApproved(args: LoopEventContext & {
  missionId: string;
  graphRunId: string;
  nodeId: string;
  approvalId: string;
  actionType: string;
  /** Latency seconds between requested and approved (Q2 time leverage). */
  latencySeconds: number;
}): Promise<boolean> {
  return emitLoopEvent('approval.approved', {
    workspaceId: args.workspaceId,
    entityId: args.missionId,
    recordedAt: args.recordedAt,
    channel: 'approval',
    metrics: {
      graph_run_id: args.graphRunId,
      node_id: args.nodeId,
      approval_id: args.approvalId,
      action_type: args.actionType,
      latency_seconds: args.latencySeconds,
    },
  });
}

/**
 * Q6 — human rejected. Fires when the gate resolves to rejected.
 * Answers: "where does the human reject?" (nodeId distribution).
 */
export async function emitApprovalRejected(args: LoopEventContext & {
  missionId: string;
  graphRunId: string;
  nodeId: string;
  approvalId: string;
  actionType: string;
  reasonCode: string;
  latencySeconds: number;
}): Promise<boolean> {
  return emitLoopEvent('approval.rejected', {
    workspaceId: args.workspaceId,
    entityId: args.missionId,
    recordedAt: args.recordedAt,
    channel: 'approval',
    metrics: {
      graph_run_id: args.graphRunId,
      node_id: args.nodeId,
      approval_id: args.approvalId,
      action_type: args.actionType,
      reason_code: args.reasonCode,
      latency_seconds: args.latencySeconds,
    },
  });
}
