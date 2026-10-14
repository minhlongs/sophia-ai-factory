/**
 * Reality Loop v1 — approval gate emitters (requested, approved, rejected).
 * @module tree/performance/loop-emitters-approval
 */

import { emitLoopEvent, type LoopEventContext } from './loop-events';

/**
 * Q2/Q6 — human approval requested. Fires when the approval gate suspends the run.
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
 */
export async function emitApprovalApproved(args: LoopEventContext & {
  missionId: string;
  graphRunId: string;
  nodeId: string;
  approvalId: string;
  actionType: string;
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
