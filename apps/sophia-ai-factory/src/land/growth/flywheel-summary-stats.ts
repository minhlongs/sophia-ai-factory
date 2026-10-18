/**
 * Land Layer: Flywheel Summary Stats Query
 * Aggregates reseed job counts and conversion attribution totals from D1.
 * @module land/growth/flywheel-summary-stats
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { FlywheelSummaryStats } from '@/seed/types/growth-triad-v12';

const EMPTY_STATS: FlywheelSummaryStats = {
  totalReseedJobs: 0,
  alphaViralDetected: 0,
  reseededCount: 0,
  totalAttributedRevenueUsd: 0,
  totalCommissionUsd: 0,
};

export async function getFlywheelSummaryStats(userId: string): Promise<FlywheelSummaryStats> {
  const db = await getD1();
  if (!db) {
    logger.warn('D1 database unavailable for getFlywheelSummaryStats');
    return { ...EMPTY_STATS };
  }

  try {
    const jobStats = await db
      .prepare(
        `SELECT
          COUNT(*) as totalJobs,
          SUM(CASE WHEN classification = 'ALPHA_VIRAL' THEN 1 ELSE 0 END) as alphaCount,
          SUM(CASE WHEN status = 'RESEEDED' THEN 1 ELSE 0 END) as reseededCount
         FROM flywheel_reseed_jobs
         WHERE user_id = ?`,
      )
      .bind(userId)
      .first<{ totalJobs: number; alphaCount: number; reseededCount: number }>();

    const attrStats = await db
      .prepare(
        `SELECT
          COALESCE(SUM(gross_amount_usd), 0) as totalGross,
          COALESCE(SUM(commission_amount_usd), 0) as totalCommission
         FROM conversion_attributions
         WHERE user_id = ?`,
      )
      .bind(userId)
      .first<{ totalGross: number; totalCommission: number }>();

    return {
      totalReseedJobs: jobStats?.totalJobs ?? 0,
      alphaViralDetected: jobStats?.alphaCount ?? 0,
      reseededCount: jobStats?.reseededCount ?? 0,
      totalAttributedRevenueUsd: attrStats?.totalGross ?? 0,
      totalCommissionUsd: attrStats?.totalCommission ?? 0,
    };
  } catch (err) {
    logger.error('Failed to aggregate flywheel summary stats', { userId, error: err });
    return { ...EMPTY_STATS };
  }
}
