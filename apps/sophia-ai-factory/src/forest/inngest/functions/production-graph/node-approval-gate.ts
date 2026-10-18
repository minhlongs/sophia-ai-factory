/**
 * Production Graph Node Approval Gate Management.
 *
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * @module forest/inngest/functions/production-graph/node-approval-gate
 */

import { PUBLISH_CONTENT_TOOL } from '@/tree/agent-protocol/graph-agents';
import { updateRunStatus } from '@/tree/production-graph/repo';
import type { GraphNodeRuntimeState } from '@/tree/production-graph/types';
import { emitApprovalApproved } from '@/tree/performance/loop-emitters-runner';
import {
  PUBLISHING_PHASE,
  type EmitStep,
  type RunnerContext,
  type RunnerLogContext,
} from './types';
import { handleRejectedOrTimedOutApproval } from './node-approval-helpers';
import { awaitNodeApprovalOutcome } from './node-approval-await';

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

  const { gateOutcome, approvalIdForEvent } = await awaitNodeApprovalOutcome({
    nodeId,
    state,
    step,
    logCtx,
    runnerContext,
  });

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
    return handleRejectedOrTimedOutApproval({
      gateOutcome,
      approvalIdForEvent,
      nodeId,
      states,
      step,
      logCtx,
      retryCount,
      runnerContext,
      totals,
    });
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
