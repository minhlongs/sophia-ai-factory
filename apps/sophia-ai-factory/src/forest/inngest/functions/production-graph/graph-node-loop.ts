/**
 * Production Graph Node Execution Loop & Cancellation Guard.
 *
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * @module forest/inngest/functions/production-graph/graph-node-loop
 */

import { handleCancellation } from './emitter-helpers';
import { checkCancellation } from './execution-helpers';
import { executeSingleNode } from './node-executor';

type SingleNodeInput = Parameters<typeof executeSingleNode>[0];

export interface RunNodeLoopParams extends Omit<SingleNodeInput, 'nodeId'> {
  topologicalOrder: string[];
}

export async function runTopologicalNodes(
  params: RunNodeLoopParams,
): Promise<{ ok: true } | { ok: false; code: string }> {
  const {
    topologicalOrder,
    states,
    step,
    logCtx,
    retryCount,
    mission,
    policy,
    providerRegistry,
    runnerContext,
    totals,
  } = params;

  for (const nodeId of topologicalOrder) {
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
      providerRegistry,
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

  return { ok: true };
}
