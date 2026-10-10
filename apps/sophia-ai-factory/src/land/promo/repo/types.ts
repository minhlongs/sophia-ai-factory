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
