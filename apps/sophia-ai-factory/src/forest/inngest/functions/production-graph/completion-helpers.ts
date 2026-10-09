/**
 * Production Graph Completion & Wrap-up Helpers.
 *
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * @module forest/inngest/functions/production-graph/completion-helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import { completeRun } from '@/tree/production-graph/repo';
import type { GraphNodeRuntimeState } from '@/tree/production-graph/types';
import { persistAgentLearning } from '../agent-context';
import { advanceMissionToReview } from '../agent-mission-lifecycle';
import type { EmitStep, RunnerLogContext } from './types';

export interface CompleteGraphRunParams {
  step: EmitStep & {
    run: (id: string, fn: () => Promise<unknown>) => Promise<unknown>;
  };
  logCtx: RunnerLogContext;
  states: Map<string, GraphNodeRuntimeState>;
  sinkIds: string[];
  totalCostCents: number;
  totalTokens: number;
}

export async function completeGraphRun(
  params: CompleteGraphRunParams,
): Promise<void> {
  const { step, logCtx, states, sinkIds, totalCostCents, totalTokens } = params;
  const { graphRunId, graphId, missionId, workspaceId } = logCtx;

  const sinkId = sinkIds[0];
  const sinkState = sinkId ? states.get(sinkId) : undefined;
  const outputJson = sinkState?.outputJson ?? null;

  await step.run('complete-run', () =>
    completeRun(graphRunId, 'running', {
      outputJson,
      totalCostCents,
      totalTokens,
    }),
  );

  // In Inngest step types, sendEvent accepts custom events
  await (
    step as unknown as {
      sendEvent: (id: string, payload: unknown) => Promise<unknown>;
    }
  ).sendEvent('emit-completed', {
    name: 'production.graph.completed',
    data: {
      graphRunId,
      graphId,
      missionId,
      workspaceId,
      totalCostCents,
      totalTokens,
    },
  });

  // Creative Memory write-back
  if (sinkState?.outputJson) {
    try {
      const sinkAgentId = sinkState.node.agentSlug ?? 'sophia-learning';
      const sinkOutput = JSON.parse(sinkState.outputJson);
      const confidence =
        typeof sinkOutput === 'object' && sinkOutput !== null
          ? (sinkOutput as { confidence?: number }).confidence
          : undefined;
      await persistAgentLearning({
        workspaceId,
        missionId,
        agentId: sinkAgentId,
        runId: graphRunId,
        confidence: typeof confidence === 'number' ? confidence : undefined,
        output: sinkOutput,
      });
    } catch (err) {
      logger.warn(
        'productionGraphRunner: persistAgentLearning failed (non-fatal)',
        {
          graphRunId,
          error: err instanceof Error ? err.message : String(err),
        },
      );
    }
  }

  await advanceMissionToReview(missionId);

  logger.info('productionGraphRunner: graph run completed', {
    graphRunId,
    graphId,
    missionId,
    totalCostCents,
    totalTokens,
  });
}
