import type { Tier } from '@/seed/types';

export type PaymentMethod = 'nowpayments' | 'payos';
export type BillingPeriod = 'monthly' | 'yearly';
export type EffectivePeriod = 'monthly' | 'yearly' | 'lifetime';

export interface CheckoutData {
  tier: string;
  url?: string;
  orderId?: string;
  period: EffectivePeriod;
  paymentMethod: PaymentMethod;
  priceCents: number;
  discountedPriceCents?: number;
  couponCode?: string;
}

export type { Tier } from '@/seed/types';
export const TIER_ORDER: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];
