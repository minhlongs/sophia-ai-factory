/**
 * Production Graph Single Node Execution Logic.
 *
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * @module forest/inngest/functions/production-graph/node-executor
 */

import { logger } from '@/seed/utils/logger-utility';
import { executeAgent, agentDefinitionRegistry } from '@/tree/agent-protocol';
import type { GraphNodeRuntimeState } from '@/tree/production-graph/types';
import type { EmitStep, RunnerContext, RunnerLogContext } from './types';
import { handleNodeApproval } from './node-approval-gate';
import { handleNodeExecutionFailure } from './node-failure-handler';
import { setupAgentExecutionContext } from './node-context-builder';
import {
  failUnregisteredAgentNode,
  failBudgetExceededNode,
  finalizeSuccessfulNodeExecution,
} from './node-executor-helpers';

export interface ExecuteNodeParams {
  nodeId: string;
  states: Map<string, GraphNodeRuntimeState>;
  step: EmitStep & {
    run: (id: string, fn: () => Promise<unknown>) => Promise<unknown>;
  };
  logCtx: RunnerLogContext;
  retryCount: number;
  mission: import('@/seed/types/creative-economy').Mission;
  policy: import('@/tree/autonomy/effective-autonomy').EffectiveAutonomyPolicy;
  providerRegistry: import('@/seed/ai/provider-registry').ProviderRegistry;
  runnerContext: RunnerContext;
  totals: { totalCostCents: number; totalTokens: number };
}

export type ExecuteNodeOutcome =
  | { ok: true; skipped: boolean }
  | { ok: false; code: string };

export async function executeSingleNode(
  params: ExecuteNodeParams,
): Promise<ExecuteNodeOutcome> {
  const { nodeId, states, step, logCtx, retryCount, mission, policy, providerRegistry, runnerContext, totals } = params;
  const { graphRunId, missionId, workspaceId } = logCtx;
  const state = states.get(nodeId);
  if (!state) return { ok: true, skipped: true };

  if (state.status === 'completed' || state.status === 'skipped') {
    logger.info('productionGraphRunner: node already done, skipping', {
      graphRunId,
      nodeId,
      status: state.status,
    });
    return { ok: true, skipped: true };
  }

  const definition = agentDefinitionRegistry.get(state.node.agentSlug);
  if (!definition) {
    return failUnregisteredAgentNode({ nodeId, agentSlug: state.node.agentSlug, states, step, logCtx, retryCount, runnerContext, totals });
  }

  const approvalResult = await handleNodeApproval({ nodeId, state, states, step, logCtx, retryCount, policy, runnerContext, totals });
  if (!approvalResult.ok) return approvalResult;
  const approvedActionIds = approvalResult.approvedActionIds;

  // Budget guard
  const budgetRemainingCents = Math.max(0, mission.budgetCents - mission.spentCents - totals.totalCostCents);
  if (budgetRemainingCents <= 0) {
    return failBudgetExceededNode({ nodeId, step, logCtx, retryCount, totals });
  }

  const agentRunId = `${graphRunId}:${nodeId}:${retryCount}`;
  state.status = 'running';
  state.agentRunId = agentRunId;
  state.startedAt = runnerContext.nowMs();

  const context = await setupAgentExecutionContext({
    agentRunId, agentSlug: state.node.agentSlug, inputJson: state.node.inputJson,
    workspaceId, missionId, graphRunId, nodeId, policy, mission, budgetRemainingCents,
    approvedActionIds, nowMs: runnerContext.nowMs,
  });

  const execution = await executeAgent(definition, context, providerRegistry);
  const endedAt = runnerContext.nowMs();

  if (!execution.ok || !execution.value.success) {
    const message = execution.ok
      ? (execution.value.error?.message ?? 'Agent returned success=false')
      : `${execution.error.code}: ${execution.error.message}`;

    return handleNodeExecutionFailure({
      nodeId, states, state, step, logCtx, retryCount, message, agentRunId, totals, endedAt,
      executionMetrics: execution.ok
        ? { costCents: execution.value.costCents, totalTokens: execution.value.totalTokens, durationMs: execution.value.durationMs }
        : undefined,
    });
  }

  await finalizeSuccessfulNodeExecution({
    nodeId, state, states, logCtx, runnerContext, endedAt, totals, executionValue: execution.value,
  });

  return { ok: true, skipped: false };
}
