/**
 * Affiliate Dashboard Stats
 *
 * Aggregate primitives backing /dashboard/affiliate page:
 * - getAffiliateClickStats: total clicks + conversions + commission + EPC over a date range
 * - getRecentConversions: paginated conversion feed scoped to affiliate
 *
 * Tenant-scoped via JOIN on affiliate_links.user_id = affiliateId.
 *
 * @module land/affiliates/dashboard-stats
 */

import { getD1Raw } from '@/seed/db/client';

export interface AffiliateClickStats {
  /** Total click_events rows scoped to (tenantId, affiliateId) within window. */
  totalClicks: number;
  /** Total approved+paid+pending conversion_events for the affiliate's links. */
  totalConversions: number;
  /** Sum of commission_usd across conversion_events (approved + paid only). */
  totalCommissionUsd: number;
  /** Earnings per click = totalCommissionUsd / totalClicks (0 if no clicks). */
  epc: number;
}

export interface ConversionFeedRow {
  conversionId: string;
  linkId: string;
  offerId: string;
  networkTransactionId: string;
  grossAmountUsd: number;
  commissionUsd: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  attributedAt: number;
}

/**
 * Aggregate clicks + conversions + commission + EPC for an affiliate.
 *
 * Uses two parallel queries:
 *   1. click_events JOIN affiliate_links to count clicks owned by user.
 *   2. conversion_events JOIN affiliate_links to sum approved/paid commissions.
 */
export async function getAffiliateClickStats(
  tenantId: string,
  affiliateId: string,
  fromTs: number,
  toTs: number,
): Promise<AffiliateClickStats> {
  const db = await getD1Raw();

  const clickRow = await db
    .prepare(
      `SELECT COUNT(*) AS total_clicks
       FROM click_events ce
       JOIN affiliate_links al ON al.id = ce.link_id
       WHERE ce.tenant_id = ?
         AND al.user_id = ?
         AND ce.clicked_at >= ? AND ce.clicked_at <= ?`,
    )
    .bind(tenantId, affiliateId, fromTs, toTs)
    .first<{ total_clicks: number }>();

  const convRow = await db
    .prepare(
      `SELECT COUNT(*) AS total_conversions,
              COALESCE(SUM(CASE WHEN cv.status IN ('approved','paid')
                                THEN cv.commission_usd ELSE 0 END), 0) AS total_commission
       FROM conversion_events cv
       JOIN affiliate_links al ON al.id = cv.link_id
       WHERE cv.tenant_id = ?
         AND al.user_id = ?
         AND cv.attributed_at >= ? AND cv.attributed_at <= ?`,
    )
    .bind(tenantId, affiliateId, fromTs, toTs)
    .first<{ total_conversions: number; total_commission: number }>();

  const totalClicks = Number(clickRow?.total_clicks ?? 0);
  const totalConversions = Number(convRow?.total_conversions ?? 0);
  const totalCommissionUsd = Number(convRow?.total_commission ?? 0);
  const epc = totalClicks > 0 ? totalCommissionUsd / totalClicks : 0;

  return { totalClicks, totalConversions, totalCommissionUsd, epc };
}

/**
 * Recent conversions for an affiliate, newest first.
 * `limit` is clamped to [1, 200]; `offset` clamped to >= 0.
 */
export async function getRecentConversions(
  tenantId: string,
  affiliateId: string,
  limit: number,
  offset: number,
): Promise<ConversionFeedRow[]> {
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  const safeOffset = Math.max(0, Math.floor(offset));
  const db = await getD1Raw();

  const result = await db
    .prepare(
      `SELECT cv.id, cv.link_id, al.offer_id, cv.network_transaction_id,
              cv.gross_amount_usd, cv.commission_usd, cv.status, cv.attributed_at
       FROM conversion_events cv
       JOIN affiliate_links al ON al.id = cv.link_id
       WHERE cv.tenant_id = ?
         AND al.user_id = ?
       ORDER BY cv.attributed_at DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(tenantId, affiliateId, safeLimit, safeOffset)
    .all<{
      id: string;
      link_id: string;
      offer_id: string;
      network_transaction_id: string;
      gross_amount_usd: number;
      commission_usd: number;
      status: 'pending' | 'approved' | 'rejected' | 'paid';
      attributed_at: number;
    }>();

  return (result.results ?? []).map((r) => ({
    conversionId: r.id,
    linkId: r.link_id,
    offerId: r.offer_id,
    networkTransactionId: r.network_transaction_id,
    grossAmountUsd: r.gross_amount_usd,
    commissionUsd: r.commission_usd,
    status: r.status,
    attributedAt: r.attributed_at,
  }));
}
