/**
 * Pricing Stitch Component Types
 *
 * Layer: forest/components/pricing/stitch
 */

import type { PromoDiscount } from '../coupon-input';

export type PaymentMethod = 'nowpayments' | 'payos';
export type BillingPeriod = 'monthly' | 'annual';

export interface CheckoutResponse {
  url?: string;
  orderId?: string;
  error?: string;
  redirectTo?: string;
  status?: string;
  handoverId?: string;
  magicLink?: string;
  message?: string;
}

export interface CardConfig {
  tier: string;
  descriptionKey: string;
  ctaVariant: 'ghost' | 'primary' | 'outline';
  highlighted?: boolean;
  priceSuffixKey: string;
}

export const CARD_CONFIGS: CardConfig[] = [
  { tier: 'BASIC', descriptionKey: 'for_starters', ctaVariant: 'ghost', priceSuffixKey: 'per_month' },
  { tier: 'PREMIUM', descriptionKey: 'popular', ctaVariant: 'primary', highlighted: true, priceSuffixKey: 'per_month' },
  { tier: 'ENTERPRISE', descriptionKey: 'unlimited_features', ctaVariant: 'outline', priceSuffixKey: 'per_month' },
  { tier: 'MASTER', descriptionKey: 'white_label_plan', ctaVariant: 'ghost', priceSuffixKey: 'one_time_label' },
];

export interface PricingStitchSectionProps {
  isAuthenticated?: boolean;
  currentTier?: string | null;
}

export interface CheckoutDataState {
  tier: string;
  url?: string;
  orderId?: string;
  period: 'monthly' | 'yearly' | 'lifetime';
  paymentMethod: PaymentMethod;
  priceCents: number;
  discountedPriceCents?: number;
  couponCode?: string;
}

export type { PromoDiscount };
