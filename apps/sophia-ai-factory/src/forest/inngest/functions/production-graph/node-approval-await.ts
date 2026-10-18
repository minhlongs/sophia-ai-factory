/**
 * Production Graph Node Approval Await & Decision Resolution Helper.
 *
 * Layer: forest (reusable infrastructure orchestrators)
 * @module forest/inngest/functions/production-graph/node-approval-await
 */

import { PUBLISH_CONTENT_TOOL } from '@/tree/agent-protocol/graph-agents';
import type { GraphNodeRuntimeState } from '@/tree/production-graph/types';
import { requestApprovalAndAwait } from '../agent-approval-gate';
import {
  APPROVAL_TIMEOUT_MS,
  type EmitStep,
  type RunnerContext,
  type RunnerLogContext,
} from './types';
import { resolveApprovalRow } from './emitter-helpers';
import {
  handleApprovalDecision,
  toApprovalGateStep,
} from './execution-helpers';
import { emitNodeApprovalRequestedSafe } from './node-approval-helpers';

export async function awaitNodeApprovalOutcome(params: {
  nodeId: string;
  state: GraphNodeRuntimeState;
  step: EmitStep & {
    run: (id: string, fn: () => Promise<unknown>) => Promise<unknown>;
  };
  logCtx: RunnerLogContext;
  runnerContext: RunnerContext;
}): Promise<{
  gateOutcome: 'approved' | 'rejected' | 'timeout';
  approvalIdForEvent: string;
}> {
  const { nodeId, state, step, logCtx, runnerContext } = params;
  const { graphRunId, missionId } = logCtx;

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

  await emitNodeApprovalRequestedSafe({ logCtx, nodeId, runnerContext });

  const gateOutcome = handleApprovalDecision(decision, graphRunId);
  const approvalRow = await resolveApprovalRow(graphRunId);
  const approvalIdForEvent = approvalRow?.id ?? '';

  return { gateOutcome, approvalIdForEvent };
}
