/**
 * Helper utilities for single node execution in the production graph runner.
 * @module forest/inngest/functions/production-graph/node-executor-helpers
 */

import type { ProductionGraphRunError } from '@/seed/types/production-factory';
import type { GraphNodeRuntimeState } from '@/tree/production-graph/types';
import type { EmitStep, RunnerContext, RunnerLogContext } from './types';
import { emitFailed, failTerminal } from './emitter-helpers';
import {
  checkpoint,
  markNodeFailed,
  recordNodePerformance,
  recordSpendSafe,
} from './execution-helpers';

export async function failUnregisteredAgentNode(params: {
  nodeId: string;
  agentSlug: string;
  states: Map<string, GraphNodeRuntimeState>;
  step: EmitStep;
  logCtx: RunnerLogContext;
  retryCount: number;
  runnerContext: RunnerContext;
  totals: { totalCostCents: number; totalTokens: number };
}): Promise<{ ok: false; code: 'NODE_FAILED' }> {
  const { nodeId, agentSlug, states, step, logCtx, retryCount, runnerContext, totals } = params;
  const { graphRunId, workspaceId, missionId } = logCtx;
  const error: ProductionGraphRunError = {
    code: 'NODE_FAILED',
    message: `Agent ${agentSlug} not registered`,
    details: { nodeId },
  };
  markNodeFailed(states, nodeId, error.message ?? 'unknown', runnerContext.nowMs);
  await checkpoint(graphRunId, states);
  await failTerminal(graphRunId, 'running', error, totals, workspaceId, missionId);
  await emitFailed(step, logCtx, error, retryCount);
  return { ok: false, code: 'NODE_FAILED' };
}

export async function failBudgetExceededNode(params: {
  nodeId: string;
  step: EmitStep;
  logCtx: RunnerLogContext;
  retryCount: number;
  totals: { totalCostCents: number; totalTokens: number };
}): Promise<{ ok: false; code: 'BUDGET_EXCEEDED' }> {
  const { nodeId, step, logCtx, retryCount, totals } = params;
  const { graphRunId, workspaceId, missionId } = logCtx;
  const error: ProductionGraphRunError = {
    code: 'BUDGET_EXCEEDED',
    message: 'Mission budget exhausted before node execution',
    details: { nodeId, totalCostCents: totals.totalCostCents },
  };
  await failTerminal(graphRunId, 'running', error, totals, workspaceId, missionId);
  await emitFailed(step, logCtx, error, retryCount);
  return { ok: false, code: 'BUDGET_EXCEEDED' };
}

export async function finalizeSuccessfulNodeExecution(params: {
  nodeId: string;
  state: GraphNodeRuntimeState;
  states: Map<string, GraphNodeRuntimeState>;
  logCtx: RunnerLogContext;
  runnerContext: RunnerContext;
  endedAt: number;
  totals: { totalCostCents: number; totalTokens: number };
  executionValue: {
    output?: unknown;
    costCents: number;
    totalTokens: number;
    durationMs: number;
  };
}): Promise<void> {
  const { nodeId, state, states, logCtx, runnerContext, endedAt, totals, executionValue } = params;
  const { graphRunId, workspaceId, missionId } = logCtx;

  state.status = 'completed';
  state.outputJson = JSON.stringify(executionValue.output ?? null);
  state.endedAt = endedAt;
  totals.totalCostCents += executionValue.costCents;
  totals.totalTokens += executionValue.totalTokens;

  if (executionValue.costCents > 0) {
    await recordSpendSafe(missionId, executionValue.costCents);
  }
  await checkpoint(graphRunId, states);
  await recordNodePerformance({
    workspaceId,
    missionId,
    graphRunId,
    nodeId,
    agentSlug: state.node.agentSlug,
    costCents: executionValue.costCents,
    totalTokens: executionValue.totalTokens,
    durationMs: executionValue.durationMs,
    recordedAt: runnerContext.nowMs(),
  });
}
