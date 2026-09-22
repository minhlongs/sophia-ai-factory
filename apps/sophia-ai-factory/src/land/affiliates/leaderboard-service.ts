/**
 * Affiliate Monthly Leaderboard Service
 *
 * Aggregates Top 10 affiliate partners each month, calculates rankings based on activated MRR
 * and commission volume, and manages the $850 USD monthly bonus prize pool (1st: $500, 2nd: $250, 3rd: $100).
 *
 * @module land/affiliates/leaderboard-service
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  AffiliateTier,
  LeaderboardEntry,
  LeaderboardSummary,
  LEADERBOARD_BONUS_POOL,
} from '@/seed/types/affiliate-expansion-types';

/**
 * Anonymize or mask partner codes for public privacy while retaining brand prestige.
 * E.g., "PARTNER_VIETNAM_99" -> "PART***99"
 */
export function maskPartnerCode(code: string): string {
  if (!code || code.length <= 4) return code || 'ANON';
  const prefix = code.slice(0, Math.min(4, Math.floor(code.length / 2)));
  const suffix = code.slice(-2);
  return `${prefix}***${suffix}`;
}

/**
 * Assign bonus prize pool amount by rank.
 */
export function getBonusRewardForRank(rank: number): number {
  switch (rank) {
    case 1:
      return LEADERBOARD_BONUS_POOL.RANK_1_USD;
    case 2:
      return LEADERBOARD_BONUS_POOL.RANK_2_USD;
    case 3:
      return LEADERBOARD_BONUS_POOL.RANK_3_USD;
    default:
      return 0;
  }
}

/**
 * Format current or provided date to "YYYY-MM" month period string.
 */
export function getCurrentMonthPeriod(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

/**
 * Get start and end timestamp (epoch ms) for a given "YYYY-MM" period.
 */
export function getPeriodTimestampRange(period: string): { startMs: number; endMs: number } {
  const [yearStr, monthStr] = period.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-12

  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

  return {
    startMs: startDate.getTime(),
    endMs: endDate.getTime(),
  };
}

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
    // 1. Check if a persisted snapshot exists for this period
    const snapshotStmt = d1.prepare(`
      SELECT snapshot_json, total_prize_pool_usd, created_at
      FROM affiliate_leaderboard_snapshots
      WHERE period = ?
      LIMIT 1
    `);
    const snapshotRow = await snapshotStmt.bind(targetPeriod).first<{
      snapshot_json: string;
      total_prize_pool_usd: number;
      created_at: number;
    }>();

    if (snapshotRow?.snapshot_json) {
      try {
        const parsed = JSON.parse(snapshotRow.snapshot_json) as LeaderboardSummary;
        if (Array.isArray(parsed.topAffiliates)) {
          return parsed;
        }
      } catch (err) {
        logger.warn('[leaderboard-service] Corrupt snapshot JSON, regenerating live', {
          period: targetPeriod,
          error: String(err),
        });
      }
    }

    // 2. Aggregate live from affiliate_partners and commission_ledger
    const { startMs, endMs } = getPeriodTimestampRange(targetPeriod);

    // Query active partners ranked primarily by activated MRR and secondarily by monthly commission
    const queryStmt = d1.prepare(`
      SELECT 
        p.id,
        p.partner_code,
        p.tier,
        COALESCE(p.activated_mrr_cents, 0) as activated_mrr_cents,
        COALESCE(SUM(l.gross_cents), 0) as monthly_gross_cents,
        COALESCE(SUM(l.commission_cents), 0) as monthly_commission_cents,
        COUNT(l.id) as conversion_count
      FROM affiliate_partners p
      LEFT JOIN commission_ledger l 
        ON l.affiliate_id = p.id 
        AND l.created_at >= ? 
        AND l.created_at < ?
        AND l.status IN ('payable', 'paid', 'pending')
      WHERE p.status = 'active'
      GROUP BY p.id, p.partner_code, p.tier, p.activated_mrr_cents
      ORDER BY 
        activated_mrr_cents DESC, 
        monthly_commission_cents DESC,
        conversion_count DESC
      LIMIT 10
    `);

    const { results } = await queryStmt.bind(startMs, endMs).all<{
      id: string;
      partner_code: string;
      tier: string;
      activated_mrr_cents: number;
      monthly_gross_cents: number;
      monthly_commission_cents: number;
      conversion_count: number;
    }>();

    const rows = results ?? [];

    const topAffiliates: LeaderboardEntry[] = rows.map((row, index) => {
      const rank = index + 1;
      const mrrUsd = (row.activated_mrr_cents || 0) / 100;
      const commissionUsd = (row.monthly_commission_cents || 0) / 100;
      const bonusRewardUsd = getBonusRewardForRank(rank);
      const isTopThree = rank <= 3;
      const tier = (['SILVER', 'GOLD', 'PLATINUM'].includes(row.tier)
        ? row.tier
        : 'SILVER') as AffiliateTier;

      return {
        rank,
        partnerCode: row.partner_code,
        displayName: `Partner ${row.partner_code}`,
        maskedCode: maskPartnerCode(row.partner_code),
        tier,
        monthlyMrrUsd: Math.round(mrrUsd * 100) / 100,
        activeConversions: Number(row.conversion_count || 0),
        commissionEarnedUsd: Math.round(commissionUsd * 100) / 100,
        bonusRewardUsd,
        isTopThree,
      };
    });

    const summary: LeaderboardSummary = {
      period: targetPeriod,
      totalPrizePoolUsd: LEADERBOARD_BONUS_POOL.TOTAL_POOL_USD,
      topAffiliates,
      updatedAt: new Date().toISOString(),
    };

    return summary;
  } catch (error) {
    logger.error('[leaderboard-service] Error querying monthly leaderboard', {
      period: targetPeriod,
      error: String(error),
    });

    // Return clean fallback structure
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
