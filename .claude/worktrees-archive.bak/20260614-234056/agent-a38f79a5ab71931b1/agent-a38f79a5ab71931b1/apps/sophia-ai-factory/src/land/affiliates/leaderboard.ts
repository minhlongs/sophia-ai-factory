/**
 * Affiliate leaderboard — top affiliates by performance metric within a window.
 *
 * Aggregates click_events + conversion_events through affiliate_links.user_id.
 * Sortable by EPC (earnings per click), conversions, or commission USD.
 *
 * Used by admin dashboard `/dashboard/admin/affiliate-leaderboard`.
 *
 * @module land/affiliates/leaderboard
 */

import { getD1Raw } from '@/seed/db/client';

export type LeaderboardSortBy = 'epc' | 'conversions' | 'commission';

export interface LeaderboardRow {
  affiliateId: string;
  /** User email when joinable; falls back to affiliateId. */
  email: string | null;
  /** User display name when set. */
  name: string | null;
  totalClicks: number;
  totalConversions: number;
  totalCommissionUsd: number;
  /** Earnings per click (commission / clicks); 0 when no clicks. */
  epc: number;
}

interface RawLeaderboardRow {
  affiliate_id: string;
  email: string | null;
  name: string | null;
  total_clicks: number;
  total_conversions: number;
  total_commission: number;
}

/**
 * Top affiliates by `sortBy` within the [fromTs, toTs] window.
 * `limit` clamped to [1, 100]. Returns up to `limit` rows.
 *
 * Implementation: SQL aggregates per affiliate_links.user_id using LEFT JOINs
 * so that affiliates with clicks but zero conversions still surface.
 */
export async function getTopAffiliates(
  fromTs: number,
  toTs: number,
  limit: number,
  sortBy: LeaderboardSortBy,
): Promise<LeaderboardRow[]> {
  if (fromTs > toTs) throw new Error('fromTs must be <= toTs');
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));

  const orderColumn =
    sortBy === 'conversions'
      ? 'total_conversions'
      : sortBy === 'commission'
      ? 'total_commission'
      : 'epc_calc';

  const db = await getD1Raw();
  const result = await db
    .prepare(
      `WITH per_affiliate AS (
         SELECT al.user_id AS affiliate_id,
                COALESCE(c.total_clicks, 0) AS total_clicks,
                COALESCE(v.total_conversions, 0) AS total_conversions,
                COALESCE(v.total_commission, 0) AS total_commission
         FROM (SELECT DISTINCT user_id FROM affiliate_links) al
         LEFT JOIN (
           SELECT al2.user_id, COUNT(*) AS total_clicks
           FROM click_events ce
           JOIN affiliate_links al2 ON al2.id = ce.link_id
           WHERE ce.clicked_at >= ?1 AND ce.clicked_at <= ?2
           GROUP BY al2.user_id
         ) c ON c.user_id = al.user_id
         LEFT JOIN (
           SELECT al3.user_id,
                  COUNT(*) AS total_conversions,
                  SUM(CASE WHEN cv.status IN ('approved','paid')
                           THEN cv.commission_usd ELSE 0 END) AS total_commission
           FROM conversion_events cv
           JOIN affiliate_links al3 ON al3.id = cv.link_id
           WHERE cv.attributed_at >= ?1 AND cv.attributed_at <= ?2
           GROUP BY al3.user_id
         ) v ON v.user_id = al.user_id
       )
       SELECT pa.affiliate_id,
              u.email, u.name,
              pa.total_clicks,
              pa.total_conversions,
              pa.total_commission,
              CASE WHEN pa.total_clicks > 0
                   THEN pa.total_commission / pa.total_clicks
                   ELSE 0 END AS epc_calc
       FROM per_affiliate pa
       LEFT JOIN "user" u ON u.id = pa.affiliate_id
       ORDER BY ${orderColumn} DESC, pa.total_clicks DESC
       LIMIT ?3`,
    )
    .bind(fromTs, toTs, safeLimit)
    .all<RawLeaderboardRow & { epc_calc: number }>();

  return (result.results ?? []).map((r) => {
    const totalClicks = Number(r.total_clicks);
    const totalCommission = Number(r.total_commission);
    return {
      affiliateId: r.affiliate_id,
      email: r.email ?? null,
      name: r.name ?? null,
      totalClicks,
      totalConversions: Number(r.total_conversions),
      totalCommissionUsd: totalCommission,
      epc: totalClicks > 0 ? totalCommission / totalClicks : 0,
    };
  });
}
