/**
 * D1 Aggregation Queries for Partner Analytics Summary.
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/analytics/d1-summary-queries
 */

import type { PartnerTier } from '@/tree/partners/types';

export interface ProfileRow {
  id: string;
  partner_name: string;
  tier: PartnerTier;
  total_referred_customers: number;
  total_mrr_cents: number;
  total_earnings_cents: number;
  pending_payout_cents: number;
}

export interface CommissionRow {
  referred_user_id: string;
  order_id: string;
  mrr_cents: number;
  commission_cents: number;
  created_at: number;
}

export interface PoolRow {
  total_mcu_credits: number;
  allocated_mcu_credits: number;
  consumed_mcu_credits: number;
}

export async function fetchPartnerProfile(
  db: D1Database,
  partnerId: string,
): Promise<ProfileRow | undefined> {
  try {
    const res = await db
      .prepare(
        `SELECT id, partner_name, tier, total_referred_customers, total_mrr_cents,
                total_earnings_cents, pending_payout_cents
         FROM partner_profiles
         WHERE id = ?1`,
      )
      .bind(partnerId)
      .first<ProfileRow>();
    return res ?? undefined;
  } catch {
    return undefined;
  }
}

export async function fetchPartnerCommissions(
  db: D1Database,
  partnerId: string,
): Promise<CommissionRow[]> {
  try {
    const res = await db
      .prepare(
        `SELECT referred_user_id, order_id, mrr_cents, commission_cents, created_at
         FROM partner_commissions
         WHERE partner_id = ?1 AND status IN ('pending', 'approved', 'paid')
         ORDER BY created_at ASC`,
      )
      .bind(partnerId)
      .all<CommissionRow>();
    return res.results || [];
  } catch {
    return [];
  }
}

export async function fetchPartnerPoolStats(
  db: D1Database,
  partnerId: string,
): Promise<PoolRow | undefined> {
  try {
    const res = await db
      .prepare(
        `SELECT SUM(total_mcu_credits) as total_mcu_credits,
                SUM(allocated_mcu_credits) as allocated_mcu_credits,
                SUM(consumed_mcu_credits) as consumed_mcu_credits
         FROM partner_license_pools
         WHERE partner_id = ?1 AND status = 'active'`,
      )
      .bind(partnerId)
      .first<PoolRow>();
    return res ?? undefined;
  } catch {
    return undefined;
  }
}
