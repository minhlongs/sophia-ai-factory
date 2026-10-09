/**
 * Production Graph Single Node Execution Failure Handlers.
 *
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * @module forest/inngest/functions/production-graph/node-failure-handler
 */

import type { ProductionGraphRunError } from '@/seed/types/production-factory';
import type { GraphNodeRuntimeState } from '@/tree/production-graph/types';
import { emitAgentFailed } from '@/tree/performance/loop-emitters-runner';
import { classifyAutonomyFailure } from '@/tree/performance/loop-events';
import type { EmitStep, RunnerLogContext } from './types';
import { emitFailed, failTerminal } from './emitter-helpers';
import { checkpoint } from './execution-helpers';

export interface HandleNodeFailureParams {
  nodeId: string;
  states: Map<string, GraphNodeRuntimeState>;
  state: GraphNodeRuntimeState;
  step: EmitStep;
  logCtx: RunnerLogContext;
  retryCount: number;
  message: string;
  agentRunId: string;
  totals: { totalCostCents: number; totalTokens: number };
  endedAt: number;
  executionMetrics?: {
    costCents: number;
    totalTokens: number;
    durationMs: number;
  };
}

export async function handleNodeExecutionFailure(
  params: HandleNodeFailureParams,
): Promise<{ ok: false; code: 'NODE_FAILED' }> {
  const {
    nodeId,
    states,
    state,
    step,
    logCtx,
    retryCount,
    message,
    agentRunId,
    totals,
    endedAt,
    executionMetrics,
  } = params;
  const { graphRunId, missionId, workspaceId } = logCtx;

  const error: ProductionGraphRunError = {
    code: 'NODE_FAILED',
    message: `Node ${nodeId} failed: ${message}`,
    details: { nodeId, agentSlug: state.node.agentSlug },
  };

  state.status = 'failed';
  state.errorMessage = message;
  state.endedAt = endedAt;

  if (executionMetrics) {
    totals.totalCostCents += executionMetrics.costCents;
    totals.totalTokens += executionMetrics.totalTokens;
  }

  await emitAgentFailed({
    workspaceId,
    missionId,
    graphRunId,
    nodeId,
    agentSlug: state.node.agentSlug,
    agentRunId,
    errorCode: error.code,
    errorMessage: error.message ?? error.code,
    failureClass: classifyAutonomyFailure(error, {
      code: error.code,
      message: error.message ?? undefined,
    }),
    costCents: executionMetrics?.costCents ?? 0,
    totalTokens: executionMetrics?.totalTokens ?? 0,
    durationMs: executionMetrics?.durationMs ?? 0,
    recordedAt: endedAt,
  });

  await checkpoint(graphRunId, states);
  await failTerminal(graphRunId, 'running', error, totals, workspaceId, missionId);
  await emitFailed(step, logCtx, error, retryCount);

  return { ok: false, code: 'NODE_FAILED' };
}
