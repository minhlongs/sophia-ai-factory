/**
 * Partner Commission Accrual & Ledger Ingestion.
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/service/commission-accrual
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  AccrueCommissionInput,
  CommissionResult,
  PartnerCommission,
} from '@/tree/partners/types';
import {
  calculateCommissionCents,
  isWithinAttributionWindow,
} from './commission-math';
import { getPartnerById } from './partner-profile';
import { evaluatePartnerTierPromotion } from './tier-promotion';

/**
 * Accrues a partner commission for an order payment.
 *
 * Rules:
 * 1. Anti-self-referral: Rejects with 'SELF_REFERRAL_PROHIBITED' if partner.user_id === referredUserId.
 * 2. Attribution window: Rejects with 'ATTRIBUTION_WINDOW_EXPIRED' if referral was > 90 days ago.
 * 3. Idempotency: Returns existing record if (partner_id, order_id) already processed.
 * 4. Zero penny leakage: integer cent calculation.
 * 5. Automatic promotion: Evaluates tier upgrade on customer/MRR increase.
 */
export async function accruePartnerCommission(
  db: D1Database,
  input: AccrueCommissionInput,
  nowMs = Date.now(),
): Promise<CommissionResult> {
  const partner = await getPartnerById(db, input.partnerId);
  if (!partner) {
    return {
      success: false,
      partnerId: input.partnerId,
      orderId: input.orderId,
      commissionCents: 0,
      commissionRatePct: 0,
      tierAtTime: 'SILVER',
      error: `Partner profile ${input.partnerId} does not exist`,
    };
  }

  // 1. Anti-Self-Referral Check (User-level)
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

  // 2. Anti-Self-Referral Collusion Check (Tenant-level)
  if (Boolean(input.referredTenantId) && partner.tenant_id === input.referredTenantId) {
    return {
      success: false,
      partnerId: input.partnerId,
      orderId: input.orderId,
      commissionCents: 0,
      commissionRatePct: partner.commission_rate_pct,
      tierAtTime: partner.tier,
      error: 'SELF_TENANT_REFERRAL_PROHIBITED: Referrer cannot earn commissions on orders from their own tenant organization',
    };
  }

  // 3. 90-Day Referral Window Attribution Check
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

  // 4. Idempotency Check on (partner_id, order_id)
  const existing = await db
    .prepare('SELECT * FROM partner_commissions WHERE partner_id = ?1 AND order_id = ?2 LIMIT 1')
    .bind(input.partnerId, input.orderId)
    .first<PartnerCommission>();

  if (existing) {
    return {
      success: true,
      commissionId: existing.id,
      partnerId: input.partnerId,
      orderId: input.orderId,
      commissionCents: existing.commission_cents,
      commissionRatePct: existing.commission_rate_pct,
      tierAtTime: existing.tier_at_time,
      duplicate: true,
    };
  }

  // 5. Calculate Commission Amount with integer floor
  const commissionCents = calculateCommissionCents(input.mrrCents, partner.commission_rate_pct);
  const commissionId = `com_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  // 6. Insert Commission Entry
  await db
    .prepare(
      `INSERT INTO partner_commissions (
        id, partner_id, referred_user_id, referred_tenant_id, order_id, mrr_cents,
        commission_rate_pct, commission_cents, tier_at_time, status, payout_batch_id,
        period_start, period_end, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'pending', NULL, ?10, ?11, ?12)`
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

  // 7. Update Partner Profile Totals
  const addedCustomer = input.isNewCustomer ? 1 : 0;
  await db
    .prepare(
      `UPDATE partner_profiles
       SET total_referred_customers = total_referred_customers + ?1,
           total_mrr_cents = total_mrr_cents + ?2,
           total_earnings_cents = total_earnings_cents + ?3,
           pending_payout_cents = pending_payout_cents + ?3,
           updated_at = ?4
       WHERE id = ?5`
    )
    .bind(
      addedCustomer,
      input.mrrCents,
      commissionCents,
      nowMs,
      input.partnerId,
    )
    .run();

  // 8. Evaluate Tier Promotion after update
  const promo = await evaluatePartnerTierPromotion(db, input.partnerId, nowMs);

  return {
    success: true,
    commissionId,
    partnerId: input.partnerId,
    orderId: input.orderId,
    commissionCents,
    commissionRatePct: partner.commission_rate_pct,
    tierAtTime: partner.tier,
    tierPromoted: promo.promoted,
    newTier: promo.newTier,
  };
}
