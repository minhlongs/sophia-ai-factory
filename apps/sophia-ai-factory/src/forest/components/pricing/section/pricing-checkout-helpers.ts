/**
 * Discount calculation and checkout dispatch helpers for PricingSectionView.
 * @module forest/components/pricing/section/pricing-checkout-helpers
 */

import { UNIFIED_TIERS } from "@/seed/config/tiers";
import type { PromoDiscount } from "../coupon-input";
import type { BillingPeriod, PaymentMethod, CheckoutData, CheckoutResponse } from "./types";

export function calculateDiscountedCents(
  basePriceCents: number,
  appliedDiscount: PromoDiscount | null,
): number | undefined {
  if (!appliedDiscount) return undefined;
  if (
    appliedDiscount.appliesToTier &&
    appliedDiscount.discountType !== "free_trial" &&
    appliedDiscount.discountType !== "free_full"
  ) {
    return undefined;
  }
  if (appliedDiscount.discountType === "percent_off") {
    return Math.max(0, Math.round(basePriceCents * (1 - appliedDiscount.discountValue / 100)));
  }
  if (appliedDiscount.discountType === "fixed_off") {
    return Math.max(0, basePriceCents - appliedDiscount.discountValue);
  }
  return undefined;
}

export function prepareTierCheckoutInit(params: {
  tier: string;
  billingPeriod: BillingPeriod;
  paymentMethod: PaymentMethod;
  appliedDiscount: PromoDiscount | null;
  pricingTiers: Array<{ tier: string; monthlyPrice: number }>;
  masterTierPrice: number;
}): {
  body: Record<string, unknown>;
  initialCheckoutData: CheckoutData;
} {
  const { tier, billingPeriod, paymentMethod, appliedDiscount, pricingTiers, masterTierPrice } = params;
  const period =
    tier === "MASTER" ? "lifetime" : billingPeriod === "annual" ? "yearly" : "monthly";
  const body: Record<string, unknown> = { tier, paymentMethod, period };
  if (
    appliedDiscount &&
    (appliedDiscount.discountType === "percent_off" || appliedDiscount.discountType === "fixed_off")
  ) {
    body.promoCode = appliedDiscount.code;
  }

  const isAnnual = billingPeriod === "annual";
  const tierConfig = UNIFIED_TIERS[tier as keyof typeof UNIFIED_TIERS];
  const annualPriceCents =
    isAnnual && tierConfig && tierConfig.yearlyPrice > 0
      ? tierConfig.yearlyPrice * 100
      : undefined;
  const pricing = pricingTiers.find((p) => p.tier === tier);
  const monthlyPrice = pricing ? pricing.monthlyPrice : 0;
  const baseCents =
    tier === "MASTER"
      ? masterTierPrice
      : isAnnual && annualPriceCents
        ? annualPriceCents
        : monthlyPrice;
  const discountedCents = calculateDiscountedCents(baseCents, appliedDiscount);

  return {
    body,
    initialCheckoutData: {
      tier,
      period: period as "monthly" | "yearly" | "lifetime",
      paymentMethod,
      priceCents: baseCents,
      discountedPriceCents: discountedCents,
      couponCode: appliedDiscount?.code,
    },
  };
}

export async function postCheckoutRequest(
  body: Record<string, unknown>,
  csrfHeaders: Record<string, string>,
): Promise<{ status: number; data: CheckoutResponse }> {
  const response = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...csrfHeaders },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as CheckoutResponse;
  return { status: response.status, data };
}
