/**
 * Production Graph Node Approval Gate Management.
 *
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * @module forest/inngest/functions/production-graph/node-approval-gate
 */

import { logger } from '@/seed/utils/logger-utility';
import type { ProductionGraphRunError } from '@/seed/types/production-factory';
import { PUBLISH_CONTENT_TOOL } from '@/tree/agent-protocol/graph-agents';
import { updateRunStatus } from '@/tree/production-graph/repo';
import type { GraphNodeRuntimeState } from '@/tree/production-graph/types';
import {
  emitApprovalRequested,
  emitApprovalApproved,
  emitApprovalRejected,
} from '@/tree/performance/loop-emitters-runner';
import { requestApprovalAndAwait } from '../agent-approval-gate';
import {
  APPROVAL_TIMEOUT_MS,
  PUBLISHING_PHASE,
  type EmitStep,
  type RunnerContext,
  type RunnerLogContext,
} from './types';
import {
  emitFailed,
  failTerminal,
  resolveApprovalRow,
} from './emitter-helpers';
import {
  checkpoint,
  handleApprovalDecision,
  markNodeFailed,
  toApprovalGateStep,
} from './execution-helpers';

export interface HandleApprovalParams {
  nodeId: string;
  state: GraphNodeRuntimeState;
  states: Map<string, GraphNodeRuntimeState>;
  step: EmitStep & {
    run: (id: string, fn: () => Promise<unknown>) => Promise<unknown>;
  };
  logCtx: RunnerLogContext;
  retryCount: number;
  policy: import('@/tree/autonomy/effective-autonomy').EffectiveAutonomyPolicy;
  runnerContext: RunnerContext;
  totals: { totalCostCents: number; totalTokens: number };
}

export type ApprovalGateResult =
  | { ok: true; approvedActionIds?: string[] }
  | { ok: false; code: string };

export async function handleNodeApproval(
  params: HandleApprovalParams,
): Promise<ApprovalGateResult> {
  const {
    nodeId,
    state,
    states,
    step,
    logCtx,
    retryCount,
    policy,
    runnerContext,
    totals,
  } = params;

  const { graphRunId, missionId, workspaceId } = logCtx;
  const isPublishNode = state.node.isPublishNode === true;
  const needsApproval =
    isPublishNode && policy.requiresApproval(PUBLISH_CONTENT_TOOL);

  if (!needsApproval) {
    return {
      ok: true,
      approvedActionIds: isPublishNode ? [PUBLISH_CONTENT_TOOL] : undefined,
    };
  }

  await step.run(`set-awaiting-${nodeId}`, () =>
    updateRunStatus(
      graphRunId,
      'running',
      'awaiting_approval',
      PUBLISHING_PHASE,
    ),
  );

  const decision = await requestApprovalAndAwait(
    {
      runId: graphRunId,
      missionId,
      actionId: PUBLISH_CONTENT_TOOL,
      actionType: PUBLISH_CONTENT_TOOL,
      actionSummary: `Publish node "${state.node.name ?? nodeId}" via agent ${state.node.agentSlug}`,
      timeoutMs: APPROVAL_TIMEOUT_MS,
    },
    { step: toApprovalGateStep(step) },
  );

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

  const gateOutcome = handleApprovalDecision(decision, graphRunId);
  const approvalRow = await resolveApprovalRow(graphRunId);
  const approvalIdForEvent = approvalRow?.id ?? '';

  if (gateOutcome === 'approved') {
    await emitApprovalApproved({
      workspaceId,
      missionId,
      graphRunId,
      nodeId,
      approvalId: approvalIdForEvent,
      actionType: PUBLISH_CONTENT_TOOL,
      latencySeconds: 0,
      recordedAt: runnerContext.nowMs(),
    });
  } else {
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

  await step.run(`resume-running-${nodeId}`, () =>
    updateRunStatus(
      graphRunId,
      'awaiting_approval',
      'running',
      PUBLISHING_PHASE,
    ),
  );

  return { ok: true, approvedActionIds: [PUBLISH_CONTENT_TOOL] };
}
