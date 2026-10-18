/**
 * Production Graph Runner Event Emitter & Status Helpers.
 *
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * @module forest/inngest/functions/production-graph/emitter-helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  ProductionGraphRunError,
  ProductionGraphCancelledEvent,
} from '@/seed/types/production-factory';
import type { EmitStep, RunnerLogContext } from './types';

export { failTerminal, resolveApprovalRow } from './terminal-helpers';

/** Emit production.graph.failed with the structured error code. */
export async function emitFailed(
  step: EmitStep,
  logCtx: RunnerLogContext,
  error: ProductionGraphRunError,
  retryCount: number,
): Promise<void> {
  logger.error('productionGraphRunner: graph run failed', {
    ...logCtx,
    code: error.code,
    message: error.message ?? error.code,
  });
  await step.sendEvent('emit-failed', {
    name: 'production.graph.failed',
    data: {
      graphRunId: logCtx.graphRunId,
      graphId: logCtx.graphId,
      missionId: logCtx.missionId,
      workspaceId: logCtx.workspaceId,
      errorCode: error.code,
      errorMessage: error.message ?? error.code,
      retryCount,
    },
  });
}

/**
 * Handle cancellation: emit cancelled event, log.
 */
export async function handleCancellation(
  step: EmitStep,
  logCtx: RunnerLogContext,
  reason: string,
  retryCount: number,
  totalCostCents: number,
  totalTokens: number,
): Promise<void> {
  logger.info('productionGraphRunner: graph run cancelled', {
    ...logCtx,
    reason,
    totalCostCents,
    totalTokens,
  });

  const cancelledAt = Date.now();

  await step.sendEvent('emit-cancelled', {
    name: 'production.graph.cancelled',
    data: {
      graphRunId: logCtx.graphRunId,
      graphId: logCtx.graphId,
      missionId: logCtx.missionId,
      workspaceId: logCtx.workspaceId,
      cancelledAt,
      reason,
    } as ProductionGraphCancelledEvent['data'],
  });
}
