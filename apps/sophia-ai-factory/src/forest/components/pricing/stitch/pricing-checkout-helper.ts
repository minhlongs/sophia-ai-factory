/**
 * Discount calculation and checkout session request helpers for PricingStitchSection.
 * @module forest/components/pricing/stitch/pricing-checkout-helper
 */

import { UNIFIED_TIERS } from '@/seed/config/tiers';
import type { PromoDiscount } from '../coupon-input';
import type { BillingPeriod, CheckoutResponse, CheckoutDataState } from './types';

export function calculateDiscount(base: number, d: PromoDiscount | null): number | undefined {
  if (!d || (d.appliesToTier && d.discountType !== 'free_trial' && d.discountType !== 'free_full')) {
    return undefined;
  }
  if (d.discountType === 'percent_off') return Math.max(0, Math.round(base * (1 - d.discountValue / 100)));
  if (d.discountType === 'fixed_off') return Math.max(0, base - d.discountValue);
  return undefined;
}

export function resolveTierBaseCents(
  tierKey: string,
  isAnnual: boolean,
  masterTierPrice: number,
): number {
  const tierConfig = UNIFIED_TIERS[tierKey as keyof typeof UNIFIED_TIERS];
  if (tierKey === 'MASTER') return masterTierPrice;
  if (isAnnual) {
    return tierConfig?.yearlyPrice ? tierConfig.yearlyPrice * 100 : tierConfig?.priceInCents ?? 0;
  }
  return tierConfig?.priceInCents ?? 0;
}

export async function requestTierCheckout(params: {
  tierKey: string;
  billingPeriod: BillingPeriod;
  appliedDiscount: PromoDiscount | null;
  csrfHeaders: Record<string, string>;
  masterTierPrice: number;
}): Promise<CheckoutDataState> {
  const { tierKey, billingPeriod, appliedDiscount, csrfHeaders, masterTierPrice } = params;
  const period = tierKey === 'MASTER' ? 'lifetime' : billingPeriod === 'annual' ? 'yearly' : 'monthly';
  const body: Record<string, unknown> = { tier: tierKey, paymentMethod: 'nowpayments', period };
  if (
    appliedDiscount &&
    (appliedDiscount.discountType === 'percent_off' || appliedDiscount.discountType === 'fixed_off')
  ) {
    body.promoCode = appliedDiscount.code;
  }

  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errData = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errData.error || `HTTP ${res.status}`);
  }

  const data: CheckoutResponse = await res.json();
  const isAnnual = billingPeriod === 'annual';
  const baseCents = resolveTierBaseCents(tierKey, isAnnual, masterTierPrice);
  const discountedCents = calculateDiscount(baseCents, appliedDiscount);

  return {
    tier: tierKey,
    url: data.url,
    orderId: data.orderId,
    period,
    paymentMethod: 'nowpayments',
    priceCents: baseCents,
    discountedPriceCents: discountedCents,
    couponCode: appliedDiscount?.code,
  };
}
