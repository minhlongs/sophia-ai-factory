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

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  ActionResult,
  CohortTriangularMatrix,
  ConsolidateChannelsInput,
  MrrMilestoneProgress,
  UnifiedRevenueSnapshot,
} from '@/seed/types/unified-revenue';
import {
  aggregateRealtimeMrrFromD1,
  consolidateMrrChannels,
  getLatestUnifiedRevenueSnapshot,
  getUnifiedRevenueSnapshotsHistory,
  saveUnifiedRevenueSnapshot,
} from '@/tree/revenue/mrr-consolidation-engine';
import { queryCohortMatrix } from '@/tree/revenue/cohort-retention-calculator';

function getCurrentPeriodMonth(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

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
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED: Authentication required' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database unavailable' };
    }

    const currentPeriod = getCurrentPeriodMonth();
    let snapshot = await getLatestUnifiedRevenueSnapshot(db);

    if (!snapshot || snapshot.periodMonth !== currentPeriod) {
      snapshot = await aggregateRealtimeMrrFromD1(db, currentPeriod);
    }

    const consolidated = consolidateMrrChannels({
      periodMonth: snapshot.periodMonth,
      directSalesCents: snapshot.directSalesCents,
      affiliateSalesCents: snapshot.affiliateSalesCents,
      contentSeoCents: snapshot.contentSeoCents,
      enterpriseDealsCents: snapshot.enterpriseDealsCents,
      activeCustomersCount: snapshot.activeCustomersCount,
      currency: snapshot.currency,
      status: snapshot.status,
    });

    return {
      success: true,
      data: {
        snapshot,
        progress: consolidated.progress,
      },
    };
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
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED: Authentication required' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database unavailable' };
    }

    const snapshots = await getUnifiedRevenueSnapshotsHistory(db, limit);
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
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED: Authentication required' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database unavailable' };
    }

    const matrix = await queryCohortMatrix(db, { limitMonths: months });
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
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED: Authentication required' };
    }

    const db = await getD1();
    if (!db) {
      return { success: false, error: 'Database unavailable' };
    }

    const snapshot = await saveUnifiedRevenueSnapshot(db, input);
    return { success: true, data: snapshot };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[mrr-dashboard-actions] recordUnifiedRevenueSnapshotAction error', { error: message });
    return { success: false, error: message };
  }
}
