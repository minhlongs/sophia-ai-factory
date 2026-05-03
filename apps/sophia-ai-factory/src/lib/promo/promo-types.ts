/**
 * Type definitions for promo code system.
 * @module lib/promo/promo-types
 */

export type DiscountType = 'percent_off' | 'fixed_off' | 'free_trial' | 'free_full';

export type PromoCodeStatus = 'active' | 'disabled' | 'expired';

export type RedemptionStatus = 'redeemed' | 'reverted' | 'reserved';

export interface PromoCodeRow {
  id: string;
  code: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  applies_to_tier: string | null;
  applies_to_sku: string | null;
  max_uses: number | null;
  used_count: number;
  max_uses_per_user: number;
  valid_from: number;
  valid_until: number | null;
  status: PromoCodeStatus;
  created_by_admin_id: string | null;
  created_at: number;
  metadata: string | null;
}

export interface RedemptionRow {
  id: string;
  promo_code_id: string;
  promo_code: string;
  user_id: string;
  email: string | null;
  applied_to_tier: string | null;
  applied_to_sku: string | null;
  discount_applied_cents: number;
  trial_days_granted: number;
  redeemed_at: number;
  payment_id: string | null;
  handover_id: string | null;
  status: RedemptionStatus;
}

export type ValidateResult =
  | {
      valid: true;
      code: string;
      codeId: string;
      discountType: DiscountType;
      discountValue: number;
      appliesToTier: string | null;
      appliesToSku: string | null;
      description: string | null;
    }
  | {
      valid: false;
      reason: 'expired' | 'max_uses' | 'wrong_tier' | 'wrong_sku' | 'user_limit' | 'not_found' | 'not_started';
    };

export interface ApplyOptions {
  code: string;
  userId: string;
  email?: string;
  tier?: string;
  sku?: string;
  paymentAmountCents?: number;
  locale?: string;
  fullName?: string;
  agencyType?: string;
}

export interface ApplyResult {
  discountedAmountCents: number;
  originalAmountCents: number;
  trialDaysGranted: number;
  redemptionId: string;
  handoverId: string | null;
  magicLink: string | null;
}

export interface CreatePromoInput {
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  appliesToTier?: string;
  appliesToSku?: string;
  maxUses?: number;
  maxUsesPerUser?: number;
  validUntil?: number;
  metadata?: Record<string, unknown>;
}

export interface ListAdminFilters {
  status?: PromoCodeStatus;
  discountType?: DiscountType;
  appliesToTier?: string;
  limit?: number;
  offset?: number;
}
