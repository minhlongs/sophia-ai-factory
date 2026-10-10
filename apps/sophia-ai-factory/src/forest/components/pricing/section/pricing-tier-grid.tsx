"use client";

import { useTranslations } from "next-intl";
import { PricingCard } from "../pricing-card";
import { UNIFIED_TIERS } from "@/seed/config/tiers";
import type { BillingPeriod, PaymentMethod } from "./types";
import type { FeatureGroups } from "../pricing-data";

export interface PricingTierItem {
  tier: string;
  name: string;
  description: string;
  monthlyPrice: number;
  popular?: boolean;
  featureGroups: FeatureGroups;
}

interface PricingTierGridProps {
  pricingTiers: PricingTierItem[];
  billingPeriod: BillingPeriod;
  paymentMethod: PaymentMethod;
  loadingTier: string | null;
  locale: string;
  getDiscountedCents: (basePriceCents: number) => number | undefined;
  onSelectTier: (tier: string) => void;
}

export function PricingTierGrid({
  pricingTiers,
  billingPeriod,
  paymentMethod,
  loadingTier,
  locale,
  getDiscountedCents,
  onSelectTier,
}: PricingTierGridProps) {
  const t = useTranslations("landing");

  return (
    <div role="radiogroup" aria-label={t("pricing.tier_selection_label")} className="mt-4 grid gap-8 md:grid-cols-3">
      {pricingTiers.map((pricing) => {
        const tierConfig = UNIFIED_TIERS[pricing.tier as keyof typeof UNIFIED_TIERS];
        const isAnnual = billingPeriod === "annual";
        const annualPriceCents =
          isAnnual && tierConfig && tierConfig.yearlyPrice > 0 ? tierConfig.yearlyPrice * 100 : undefined;
        const yearlySavingsPercent =
          isAnnual && tierConfig && tierConfig.yearlyPrice > 0 ? tierConfig.yearlySavingsPercent : undefined;
        const baseCents = isAnnual && annualPriceCents ? annualPriceCents : pricing.monthlyPrice;
        const discountedCents = getDiscountedCents(baseCents);

        return (
          <PricingCard
            key={pricing.tier}
            name={pricing.name}
            description={pricing.description}
            tier={pricing.tier}
            monthlyPrice={pricing.monthlyPrice}
            annualPriceCents={annualPriceCents}
            billingPeriod={billingPeriod}
            featureGroups={pricing.featureGroups}
            popular={pricing.popular}
            onSelect={onSelectTier}
            loading={loadingTier === pricing.tier}
            locale={locale}
            selected={loadingTier === pricing.tier}
            discountedPriceCents={discountedCents}
            yearlySavingsPercent={yearlySavingsPercent}
            showVnd={paymentMethod === "payos"}
          />
        );
      })}
    </div>
  );
}
