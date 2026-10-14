import type { TierTransition } from './types';

export function countTierTransition(
  transitions: TierTransition[],
  from: string | null,
  to: string,
): number {
  return transitions
    .filter((t) => (from === null || t.fromTier === from) && t.toTier === to)
    .reduce((sum, t) => sum + t.count, 0);
}

export async function queryTierTransitions(
  db: D1Database,
  fromIso: string,
  toIso: string,
): Promise<TierTransition[]> {
  const rows = await db
    .prepare(
      `SELECT from_tier, to_tier, COUNT(*) AS cnt
       FROM tier_change_events
       WHERE datetime(created_at) >= datetime(?1)
         AND datetime(created_at) <= datetime(?2)
       GROUP BY from_tier, to_tier`,
    )
    .bind(fromIso, toIso)
    .all<{ from_tier: string | null; to_tier: string | null; cnt: number }>();

  return (rows.results ?? []).map((r) => ({
    fromTier: r.from_tier ?? 'FREE',
    toTier: r.to_tier ?? 'FREE',
    count: Number(r.cnt),
  }));
}

export async function queryTierCancellations(
  db: D1Database,
  fromIso: string,
  toIso: string,
): Promise<number> {
  const cancellationRows = await db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM tier_change_events
       WHERE event_type IN ('cancel', 'downgrade')
         AND datetime(created_at) >= datetime(?1)
         AND datetime(created_at) <= datetime(?2)`,
    )
    .bind(fromIso, toIso)
    .first<{ n: number }>();

  return Number(cancellationRows?.n ?? 0);
}

export async function queryPromoRedemptionStats(
  db: D1Database,
  fromEpoch: number,
  toEpoch: number,
  limit: number,
): Promise<{
  total: number;
  redeemed: number;
  reserved: number;
  reverted: number;
  topCodes: Array<{ code: string; count: number }>;
}> {
  const statusRow = await db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'redeemed' THEN 1 ELSE 0 END) AS redeemed,
         SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END) AS reserved,
         SUM(CASE WHEN status = 'reverted' THEN 1 ELSE 0 END) AS reverted
       FROM promo_code_redemptions
       WHERE redeemed_at >= ?1 AND redeemed_at <= ?2`,
    )
    .bind(fromEpoch, toEpoch)
    .first<{ total: number; redeemed: number; reserved: number; reverted: number }>();

  const topCodesRows = await db
    .prepare(
      `SELECT promo_code AS code, COUNT(*) AS cnt
       FROM promo_code_redemptions
       WHERE redeemed_at >= ?1 AND redeemed_at <= ?2
         AND status = 'redeemed'
       GROUP BY promo_code
       ORDER BY cnt DESC
       LIMIT ?3`,
    )
    .bind(fromEpoch, toEpoch, limit)
    .all<{ code: string; cnt: number }>();

  return {
    total: Number(statusRow?.total ?? 0),
    redeemed: Number(statusRow?.redeemed ?? 0),
    reserved: Number(statusRow?.reserved ?? 0),
    reverted: Number(statusRow?.reverted ?? 0),
    topCodes: (topCodesRows.results ?? []).map((r) => ({
      code: r.code,
      count: Number(r.cnt),
    })),
  };
}
