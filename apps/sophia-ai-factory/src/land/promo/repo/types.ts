/**
 * Promo code repository types and interfaces
 * @module land/promo/repo/types
 */

export type {
  PromoCodeRow,
  RedemptionRow,
  CreatePromoInput,
  ListAdminFilters,
  RedemptionStatus,
} from '../promo-types';

export interface IncrementAndRecordInput {
  codeId: string;
  promoCode: string;
  userId: string;
  email?: string;
  appliedToTier?: string;
  appliedToSku?: string;
  discountAppliedCents: number;
  trialDaysGranted: number;
  paymentId?: string;
  handoverId?: string;
  status?: import('../promo-types').RedemptionStatus;
}

export interface RecordRedemptionInput {
  promoCodeId: string;
  promoCode: string;
  userId: string;
  email?: string;
  appliedToTier?: string;
  appliedToSku?: string;
  discountAppliedCents: number;
  trialDaysGranted: number;
  paymentId?: string;
  handoverId?: string;
  status?: import('../promo-types').RedemptionStatus;
}

export const INCREMENT_PROMO_USED_SQL = `UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?1`;

export const INSERT_REDEMPTION_SQL = `INSERT INTO promo_code_redemptions
  (id, promo_code_id, promo_code, user_id, email, applied_to_tier, applied_to_sku,
   discount_applied_cents, trial_days_granted, redeemed_at, payment_id, handover_id, status)
  VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)`;

export const FINALIZE_REDEMPTION_SQL = `UPDATE promo_code_redemptions
  SET status='redeemed', payment_id=?2, handover_id=?3
  WHERE id=?1 AND status='reserved'`;

export function buildRedemptionRow(
  id: string,
  promoCodeId: string,
  input: Omit<RecordRedemptionInput, 'promoCodeId'>,
  nowSec: number,
  status: import('../promo-types').RedemptionStatus,
): import('../promo-types').RedemptionRow {
  return {
    id,
    promo_code_id: promoCodeId,
    promo_code: input.promoCode.toUpperCase(),
    user_id: input.userId,
    email: input.email ?? null,
    applied_to_tier: input.appliedToTier ?? null,
    applied_to_sku: input.appliedToSku ?? null,
    discount_applied_cents: input.discountAppliedCents,
    trial_days_granted: input.trialDaysGranted,
    redeemed_at: nowSec,
    payment_id: input.paymentId ?? null,
    handover_id: input.handoverId ?? null,
    status,
  };
}
