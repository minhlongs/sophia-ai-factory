/**
 * Telemetry and rejection/timeout helpers for production graph node approvals.
 * @module forest/inngest/functions/production-graph/node-approval-helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import type { ProductionGraphRunError } from '@/seed/types/production-factory';
import { PUBLISH_CONTENT_TOOL } from '@/tree/agent-protocol/graph-agents';
import type { GraphNodeRuntimeState } from '@/tree/production-graph/types';
import {
  emitApprovalRequested,
  emitApprovalRejected,
} from '@/tree/performance/loop-emitters-runner';
import type { EmitStep, RunnerContext, RunnerLogContext } from './types';
import {
  emitFailed,
  failTerminal,
  resolveApprovalRow,
} from './emitter-helpers';
import {
  checkpoint,
  markNodeFailed,
} from './execution-helpers';

export async function emitNodeApprovalRequestedSafe(params: {
  logCtx: RunnerLogContext;
  nodeId: string;
  runnerContext: RunnerContext;
}): Promise<void> {
  const { logCtx, nodeId, runnerContext } = params;
  const { workspaceId, missionId, graphRunId } = logCtx;
  try {
    const approvalRow = await resolveApprovalRow(graphRunId);
    await emitApprovalRequested({
      workspaceId,
      missionId,
      graphRunId,
      nodeId,
      approvalId: approvalRow?.id ?? '',
      actionType: PUBLISH_CONTENT_TOOL,
      recordedAt: runnerContext.nowMs(),
    });
  } catch (err) {
    logger.warn(
      'productionGraphRunner: approval.requested emit failed (non-fatal)',
      {
        graphRunId,
        nodeId,
        error: err instanceof Error ? err.message : String(err),
      },
    );
  }
}

export async function handleRejectedOrTimedOutApproval(params: {
  gateOutcome: 'rejected' | 'timeout';
  approvalIdForEvent: string;
  nodeId: string;
  states: Map<string, GraphNodeRuntimeState>;
  step: EmitStep;
  logCtx: RunnerLogContext;
  retryCount: number;
  runnerContext: RunnerContext;
  totals: { totalCostCents: number; totalTokens: number };
}): Promise<{ ok: false; code: string }> {
  const {
    gateOutcome,
    approvalIdForEvent,
    nodeId,
    states,
    step,
    logCtx,
    retryCount,
    runnerContext,
    totals,
  } = params;
  const { workspaceId, missionId, graphRunId } = logCtx;

  await emitApprovalRejected({
    workspaceId,
    missionId,
    graphRunId,
    nodeId,
    approvalId: approvalIdForEvent,
    actionType: PUBLISH_CONTENT_TOOL,
    reasonCode:
      gateOutcome === 'rejected' ? 'APPROVAL_REJECTED' : 'APPROVAL_TIMEOUT',
    latencySeconds: 0,
    recordedAt: runnerContext.nowMs(),
  });

  const code =
    gateOutcome === 'rejected' ? 'APPROVAL_REJECTED' : 'APPROVAL_TIMEOUT';
  const error: ProductionGraphRunError = {
    code,
    message: `Publish node ${nodeId} ${gateOutcome}`,
    details: { nodeId },
  };
  markNodeFailed(
    states,
    nodeId,
    error.message ?? gateOutcome,
    runnerContext.nowMs,
  );
  await checkpoint(graphRunId, states);
  await failTerminal(
    graphRunId,
    'awaiting_approval',
    error,
    totals,
    workspaceId,
    missionId,
  );
  await emitFailed(step, logCtx, error, retryCount);
  return { ok: false, code };
}
