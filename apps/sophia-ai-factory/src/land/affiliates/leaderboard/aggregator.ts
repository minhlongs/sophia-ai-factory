import { logger } from '@/seed/utils/logger-utility';
import {
  LeaderboardEntry,
  LeaderboardSummary,
  LEADERBOARD_BONUS_POOL,
} from '@/seed/types/affiliate-expansion-types';
import {
  getCurrentMonthPeriod,
  getPeriodTimestampRange,
} from './helpers';
import {
  fetchPersistedLeaderboardSnapshot,
  queryTopAffiliateRows,
  mapRowToLeaderboardEntry,
} from './aggregator-helpers';

export {
  fetchPersistedLeaderboardSnapshot,
  queryTopAffiliateRows,
  mapRowToLeaderboardEntry,
  type LeaderboardQueryRow,
} from './aggregator-helpers';

/**
 * Fetch and aggregate the top 10 monthly affiliates.
 * Checks for persisted snapshots in D1, or aggregates live from partners and commission ledger.
 */
export async function getMonthlyLeaderboard(
  d1: D1Database,
  period?: string
): Promise<LeaderboardSummary> {
  const targetPeriod = period || getCurrentMonthPeriod();

  try {
    const persisted = await fetchPersistedLeaderboardSnapshot(d1, targetPeriod);
    if (persisted) {
      return persisted;
    }

    const { startMs, endMs } = getPeriodTimestampRange(targetPeriod);
    const rows = await queryTopAffiliateRows(d1, startMs, endMs);
    const topAffiliates: LeaderboardEntry[] = rows.map(mapRowToLeaderboardEntry);

    return {
      period: targetPeriod,
      totalPrizePoolUsd: LEADERBOARD_BONUS_POOL.TOTAL_POOL_USD,
      topAffiliates,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[leaderboard-service] Error querying monthly leaderboard', {
      period: targetPeriod,
      error: String(error),
    });

    return {
      period: targetPeriod,
      totalPrizePoolUsd: LEADERBOARD_BONUS_POOL.TOTAL_POOL_USD,
      topAffiliates: [],
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Capture and store an official frozen snapshot of the monthly leaderboard.
 * Suitable for end-of-month prize distribution.
 */
export async function snapshotMonthlyLeaderboard(
  d1: D1Database,
  period?: string
): Promise<LeaderboardSummary> {
  const targetPeriod = period || getCurrentMonthPeriod();
  const summary = await getMonthlyLeaderboard(d1, targetPeriod);

  const snapshotId = `snapshot_${targetPeriod}`;
  const nowMs = Date.now();

  const insertStmt = d1.prepare(`
    INSERT INTO affiliate_leaderboard_snapshots (
      id,
      period,
      total_prize_pool_usd,
      snapshot_json,
      created_at
    )
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(period) DO UPDATE SET
      total_prize_pool_usd = excluded.total_prize_pool_usd,
      snapshot_json = excluded.snapshot_json,
      created_at = excluded.created_at
  `);

  await insertStmt
    .bind(
      snapshotId,
      targetPeriod,
      summary.totalPrizePoolUsd,
      JSON.stringify(summary),
      nowMs
    )
    .run();

  logger.info('[leaderboard-service] Saved leaderboard snapshot', {
    period: targetPeriod,
    topAffiliatesCount: summary.topAffiliates.length,
  });

  return summary;
}
