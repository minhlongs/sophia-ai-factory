import { logger } from '@/seed/utils/logger-utility';
import {
  AffiliateTier,
  LeaderboardEntry,
  LeaderboardSummary,
} from '@/seed/types/affiliate-expansion-types';
import {
  getBonusRewardForRank,
  maskPartnerCode,
} from './helpers';

export interface LeaderboardQueryRow {
  id: string;
  partner_code: string;
  tier: string;
  activated_mrr_cents: number;
  monthly_gross_cents: number;
  monthly_commission_cents: number;
  conversion_count: number;
}

export async function fetchPersistedLeaderboardSnapshot(
  d1: D1Database,
  targetPeriod: string
): Promise<LeaderboardSummary | null> {
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
  return null;
}

export async function queryTopAffiliateRows(
  d1: D1Database,
  startMs: number,
  endMs: number
): Promise<LeaderboardQueryRow[]> {
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

  const { results } = await queryStmt.bind(startMs, endMs).all<LeaderboardQueryRow>();
  return results ?? [];
}

export function mapRowToLeaderboardEntry(
  row: LeaderboardQueryRow,
  index: number
): LeaderboardEntry {
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
}
