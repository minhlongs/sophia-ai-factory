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
} from '@/tree/partners/types';
import { calculateCommissionCents } from './commission-math';
import { getPartnerById } from './partner-profile';
import { evaluatePartnerTierPromotion } from './tier-promotion';
import {
  findExistingCommission,
  insertCommissionAndUpdateProfile,
  validateCommissionEligibility,
} from './commission-accrual-sql';

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

  // 1-3. Eligibility checks (self-referral, tenant collusion, attribution window)
  const rejection = validateCommissionEligibility(partner, input, nowMs);
  if (rejection) {
    return rejection;
  }

  // 4. Idempotency Check on (partner_id, order_id)
  const existing = await findExistingCommission(db, input.partnerId, input.orderId);
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

  // 6-7. Insert Commission Entry & Update Partner Profile Totals
  await insertCommissionAndUpdateProfile(
    db,
    partner,
    input,
    commissionId,
    commissionCents,
    nowMs,
  );

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
