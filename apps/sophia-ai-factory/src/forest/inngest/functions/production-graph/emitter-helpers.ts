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
  ProductionGraphRunStatus,
  ProductionGraphCancelledEvent,
} from '@/seed/types/production-factory';
import { failRun } from '@/tree/production-graph/repo';
import { getD1 } from '@/seed/db/client';
import type { EmitStep, RunnerLogContext } from './types';

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

/** Best-effort terminal failure write — never throws into the handler. */
export async function failTerminal(
  graphRunId: string,
  expectedStatus: ProductionGraphRunStatus,
  error: ProductionGraphRunError,
  totals?: { totalCostCents: number; totalTokens: number },
  workspaceId?: string,
  missionId?: string,
): Promise<void> {
  try {
    await failRun(
      graphRunId,
      expectedStatus,
      error,
      totals ?? { totalCostCents: 0, totalTokens: 0 },
    );
  } catch (err) {
    logger.error('productionGraphRunner: failTerminal write failed', {
      graphRunId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Terminal-failed runs are the semantic for mission.abandoned:
  if (workspaceId && missionId) {
    try {
      const { emitMissionAbandoned } = await import(
        '@/tree/performance/loop-emitters-runner'
      );
      await emitMissionAbandoned({
        workspaceId,
        missionId,
        reason: error.code,
        stage: expectedStatus,
        recordedAt: Date.now(),
      });
    } catch (err) {
      logger.warn(
        'productionGraphRunner: mission.abandoned emit failed (non-fatal)',
        {
          graphRunId,
          workspaceId,
          missionId,
          error: err instanceof Error ? err.message : String(err),
        },
      );
    }
  }
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

/** Resolve the approval id for a run from D1. */
export async function resolveApprovalRow(
  graphRunId: string,
): Promise<{ id: string } | null> {
  try {
    const db = await getD1();
    if (!db) return null;
    return await db
      .prepare(
        `SELECT id FROM agent_approvals WHERE agent_run_id = ?1 ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(graphRunId)
      .first<{ id: string }>();
  } catch (err) {
    logger.warn(
      'productionGraphRunner: resolveApprovalRow failed (non-fatal)',
      {
        graphRunId,
        error: err instanceof Error ? err.message : String(err),
      },
    );
    return null;
  }
}
