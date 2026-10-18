/**
 * Production Graph Runner Terminal Failure & Approval Helpers.
 *
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * @module forest/inngest/functions/production-graph/terminal-helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  ProductionGraphRunError,
  ProductionGraphRunStatus,
} from '@/seed/types/production-factory';
import { failRun } from '@/tree/production-graph/repo';
import { getD1 } from '@/seed/db/client';

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
