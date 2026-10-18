'use server';

/**
 * MRR Dashboard Server Actions
 *
 * Implements:
 * - Unified 4-channel MRR overview and Gate 8 progress
 * - Historical MRR trend snapshots for executive reporting
 * - Triangular cohort retention matrix calculation and queries
 * - Manual and automated revenue snapshot persistence
 *
 * Layer: land/revenue (Server Actions - imports only from @/seed and @/tree)
 *
 * @module land/revenue/mrr-dashboard-actions
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  ActionResult,
  CohortTriangularMatrix,
  ConsolidateChannelsInput,
  MrrMilestoneProgress,
  UnifiedRevenueSnapshot,
} from '@/seed/types/unified-revenue';
import {
  getUnifiedRevenueSnapshotsHistory,
  saveUnifiedRevenueSnapshot,
} from '@/tree/revenue/mrr-consolidation-engine';
import { queryCohortMatrix } from '@/tree/revenue/cohort-retention-calculator';
import {
  requireAuthenticatedD1,
  resolveUnifiedMrrOverview,
} from './mrr-dashboard-helpers';

/**
 * Fetches the unified MRR overview and Gate 8 progress tracking.
 */
export async function getUnifiedMrrOverviewAction(): Promise<
  ActionResult<{
    snapshot: UnifiedRevenueSnapshot;
    progress: MrrMilestoneProgress;
  }>
> {
  try {
    const ctx = await requireAuthenticatedD1();
    if (!ctx.ok) return { success: false, error: ctx.error };

    const data = await resolveUnifiedMrrOverview(ctx.db);
    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[mrr-dashboard-actions] getUnifiedMrrOverviewAction error', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Fetches historical monthly MRR snapshots for executive trend charts.
 */
export async function getMrrTrendSnapshotsAction(
  limit = 12,
): Promise<ActionResult<UnifiedRevenueSnapshot[]>> {
  try {
    const ctx = await requireAuthenticatedD1();
    if (!ctx.ok) return { success: false, error: ctx.error };

    const snapshots = await getUnifiedRevenueSnapshotsHistory(ctx.db, limit);
    return { success: true, data: snapshots };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[mrr-dashboard-actions] getMrrTrendSnapshotsAction error', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Retrieves the triangular cohort retention matrix with GRR and NRR.
 */
export async function getCohortRetentionMatrixAction(
  months = 12,
): Promise<ActionResult<CohortTriangularMatrix>> {
  try {
    const ctx = await requireAuthenticatedD1();
    if (!ctx.ok) return { success: false, error: ctx.error };

    const matrix = await queryCohortMatrix(ctx.db, { limitMonths: months });
    return { success: true, data: matrix };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[mrr-dashboard-actions] getCohortRetentionMatrixAction error', { error: message });
    return { success: false, error: message };
  }
}

/**
 * Records or manually reconciles a unified revenue snapshot into D1.
 */
export async function recordUnifiedRevenueSnapshotAction(
  input: ConsolidateChannelsInput,
): Promise<ActionResult<UnifiedRevenueSnapshot>> {
  try {
    const ctx = await requireAuthenticatedD1();
    if (!ctx.ok) return { success: false, error: ctx.error };

    const snapshot = await saveUnifiedRevenueSnapshot(ctx.db, input);
    return { success: true, data: snapshot };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[mrr-dashboard-actions] recordUnifiedRevenueSnapshotAction error', { error: message });
    return { success: false, error: message };
  }
}
