/**
 * Reality Loop v1 — mission + agent + approval emitters (Phase C).
 *
 * Layer: tree (domain-specific reusable). Imports seed only.
 * @module tree/performance/loop-emitters-runner
 */

import { emitLoopEvent, type LoopEventContext, type AutonomyFailureClass } from './loop-events';
import {
  emitApprovalRequested,
  emitApprovalApproved,
  emitApprovalRejected,
} from './loop-emitters-approval';

export {
  emitApprovalRequested,
  emitApprovalApproved,
  emitApprovalRejected,
};

/**
 * Q9/Q10 — mission funnel entry. Fires once at mission creation.
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
 * Q8 — mission created but never started (abandoned).
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
 * Q7/Q8 — agent node execution started.
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
 * Q7 — agent node execution failed.
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
