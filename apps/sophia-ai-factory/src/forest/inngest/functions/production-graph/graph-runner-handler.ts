/**
 * Production Graph Main Execution Handler.
 *
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * @module forest/inngest/functions/production-graph/graph-runner-handler
 */

import { buildProviders } from '@/forest/ai/provider-factory';
import { resolveEffectiveAutonomy } from '@/tree/autonomy/effective-autonomy';
import { getRun, updateRunStatus } from '@/tree/production-graph/repo';
import { hydrateNodeStates } from '@/tree/production-graph/types';
import {
  DETERMINISTIC_TIMESTAMP,
  EXECUTING_PHASE,
  type EmitStep,
  type RunnerContext,
} from './types';
import { handleCancellation } from './emitter-helpers';
import { checkCancellation } from './execution-helpers';
import { initializeGraphRun } from './init-helpers';
import { executeSingleNode } from './node-executor';
import { completeGraphRun } from './completion-helpers';

export interface GraphRunnerInput {
  event: {
    data: {
      graphRunId: string;
      graphId: string;
      missionId: string;
      workspaceId: string;
      missionType: string;
      retryCount: number;
      deterministic?: boolean;
    };
  };
  step: EmitStep & {
    run: (id: string, fn: () => Promise<unknown>) => Promise<unknown>;
  };
}

export type GraphRunnerResult =
  | { ok: true; totalCostCents: number; totalTokens: number }
  | { ok: false; code: string };

export async function handleGraphRunner(
  input: GraphRunnerInput,
): Promise<GraphRunnerResult> {
  const { event, step } = input;
  const {
    graphRunId,
    graphId,
    missionId,
    workspaceId,
    missionType,
    retryCount,
    deterministic = false,
  } = event.data;
  const logCtx = { graphRunId, graphId, missionId, workspaceId };

  const nowMs = deterministic ? () => DETERMINISTIC_TIMESTAMP : Date.now;

  const initResult = await initializeGraphRun(step, logCtx, retryCount);
  if (!initResult.ok) {
    return initResult;
  }
  const { run, mission, validated } = initResult.context;

  if (run.status === 'queued') {
    await step.run('flip-to-running', () =>
      updateRunStatus(graphRunId, 'queued', 'running', EXECUTING_PHASE),
    );
  }

  const policy = await resolveEffectiveAutonomy({
    workspaceId,
    missionType,
    missionAutonomyLevel: mission.autonomyLevel,
  });

  const providerResult = await buildProviders({
    userId: mission.creatorId,
    providers: [
      { id: 'openrouter', label: 'OpenRouter' },
      { id: 'anthropic', label: 'Anthropic' },
    ],
    autoRegister: true,
  });

  const states = hydrateNodeStates(
    validated.definition.nodes,
    run.nodeStates,
  );
  const totals = {
    totalCostCents: run.totalCostCents,
    totalTokens: run.totalTokens,
  };

  const runnerContext: RunnerContext = {
    deterministic,
    nowMs,
    getRun,
    graphRunId,
  };

  for (const nodeId of validated.topologicalOrder) {
    const cancelCheck = await checkCancellation(runnerContext);
    if (cancelCheck.cancelled) {
      await handleCancellation(
        step,
        logCtx,
        cancelCheck.reason ?? 'Cancelled by user',
        retryCount,
        totals.totalCostCents,
        totals.totalTokens,
      );
      return { ok: false, code: 'CANCELLED' };
    }

    const nodeOutcome = await executeSingleNode({
      nodeId,
      states,
      step,
      logCtx,
      retryCount,
      mission,
      policy,
      providerRegistry: providerResult.registry,
      runnerContext,
      totals,
    });

    if (!nodeOutcome.ok) {
      return nodeOutcome;
    }
  }

  const finalCancelCheck = await checkCancellation(runnerContext);
  if (finalCancelCheck.cancelled) {
    await handleCancellation(
      step,
      logCtx,
      finalCancelCheck.reason ?? 'Cancelled by user',
      retryCount,
      totals.totalCostCents,
      totals.totalTokens,
    );
    return { ok: false, code: 'CANCELLED' };
  }

  await completeGraphRun({
    step,
    logCtx,
    states,
    sinkIds: validated.sinkIds,
    totalCostCents: totals.totalCostCents,
    totalTokens: totals.totalTokens,
  });

  return {
    ok: true,
    totalCostCents: totals.totalCostCents,
    totalTokens: totals.totalTokens,
  };
}
