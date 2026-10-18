/**
 * Partner Commission Accrual Eligibility & D1 SQL Persistence Helpers.
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/service/commission-accrual-sql
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  AccrueCommissionInput,
  CommissionResult,
  PartnerCommission,
  PartnerProfile,
} from '@/tree/partners/types';
import { isWithinAttributionWindow } from './commission-math';

export function validateCommissionEligibility(
  partner: PartnerProfile,
  input: AccrueCommissionInput,
  nowMs: number,
): CommissionResult | null {
  if (partner.user_id === input.referredUserId) {
    return {
      success: false,
      partnerId: input.partnerId,
      orderId: input.orderId,
      commissionCents: 0,
      commissionRatePct: partner.commission_rate_pct,
      tierAtTime: partner.tier,
      error: 'SELF_REFERRAL_PROHIBITED: Referrer cannot be the same user as the customer',
    };
  }

  if (Boolean(input.referredTenantId) && partner.tenant_id === input.referredTenantId) {
    return {
      success: false,
      partnerId: input.partnerId,
      orderId: input.orderId,
      commissionCents: 0,
      commissionRatePct: partner.commission_rate_pct,
      tierAtTime: partner.tier,
      error:
        'SELF_TENANT_REFERRAL_PROHIBITED: Referrer cannot earn commissions on orders from their own tenant organization',
    };
  }

  if (input.referredAtMs !== undefined && !isWithinAttributionWindow(input.referredAtMs, nowMs)) {
    return {
      success: false,
      partnerId: input.partnerId,
      orderId: input.orderId,
      commissionCents: 0,
      commissionRatePct: partner.commission_rate_pct,
      tierAtTime: partner.tier,
      error: 'ATTRIBUTION_WINDOW_EXPIRED: Referral occurred outside the 90-day attribution window',
    };
  }

  return null;
}

export async function findExistingCommission(
  db: D1Database,
  partnerId: string,
  orderId: string,
): Promise<PartnerCommission | null> {
  return db
    .prepare('SELECT * FROM partner_commissions WHERE partner_id = ?1 AND order_id = ?2 LIMIT 1')
    .bind(partnerId, orderId)
    .first<PartnerCommission>();
}

export async function insertCommissionAndUpdateProfile(
  db: D1Database,
  partner: PartnerProfile,
  input: AccrueCommissionInput,
  commissionId: string,
  commissionCents: number,
  nowMs: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO partner_commissions (
        id, partner_id, referred_user_id, referred_tenant_id, order_id, mrr_cents,
        commission_rate_pct, commission_cents, tier_at_time, status, payout_batch_id,
        period_start, period_end, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'pending', NULL, ?10, ?11, ?12)`,
    )
    .bind(
      commissionId,
      input.partnerId,
      input.referredUserId,
      input.referredTenantId,
      input.orderId,
      input.mrrCents,
      partner.commission_rate_pct,
      commissionCents,
      partner.tier,
      input.periodStart ?? null,
      input.periodEnd ?? null,
      nowMs,
    )
    .run();

  const addedCustomer = input.isNewCustomer ? 1 : 0;
  await db
    .prepare(
      `UPDATE partner_profiles
       SET total_referred_customers = total_referred_customers + ?1,
           total_mrr_cents = total_mrr_cents + ?2,
           total_earnings_cents = total_earnings_cents + ?3,
           pending_payout_cents = pending_payout_cents + ?3,
           updated_at = ?4
       WHERE id = ?5`,
    )
    .bind(
      addedCustomer,
      input.mrrCents,
      commissionCents,
      nowMs,
      input.partnerId,
    )
    .run();
}
