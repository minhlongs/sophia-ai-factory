/**
 * Coupon & Promo Discount Types
 *
 * Layer: forest/components/pricing/coupon
 */

export interface PromoDiscount {
  code: string;
  discountType: string;
  discountValue: number;
  appliesToTier: string | null;
  description: string | null;
}

export interface PromoValidateSuccess {
  valid: true;
  code: string;
  codeId: string;
  discountType: "percent_off" | "fixed_off" | "free_trial" | "free_full";
  discountValue: number;
  appliesToTier: string | null;
  appliesToSku: string | null;
  description: string | null;
}

export interface PromoValidateFailure {
  valid: false;
  reason: string;
}

export type PromoValidateResponse = (PromoValidateSuccess | PromoValidateFailure) & {
  error?: string;
};

export interface CouponInputProps {
  /** Called when a discount code (percent_off / fixed_off) is validated */
  onDiscountApplied: (discount: PromoDiscount) => void;
  /** Called when coupon is cleared */
  onDiscountCleared: () => void;
  /** Optional user ID for per-user limit check */
  userId?: string;
}

export interface FreeModalState {
  open: boolean;
  code: string;
  discountType: "free_trial" | "free_full";
  discountValue: number;
  appliesToTier: string | null;
}
