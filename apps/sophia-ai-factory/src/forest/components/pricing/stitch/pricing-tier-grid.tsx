/**
 * Pricing Tier Grid Component
 *
 * Layer: forest/components/pricing/stitch
 */

'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { usePricingData } from '../pricing-data';
import type { PromoDiscount } from '../coupon-input';
import { TierCard } from './tier-card';
import { CARD_CONFIGS } from './types';
import { calculateDiscount, resolveTierBaseCents } from './pricing-checkout-helper';

interface PricingTierGridProps {
  isAnnual: boolean;
  loading: string | null;
  locale: string;
  appliedDiscount: PromoDiscount | null;
  onSelectTier: (tierKey: string) => void;
}

export function PricingTierGrid({
  isAnnual,
  loading,
  locale,
  appliedDiscount,
  onSelectTier,
}: PricingTierGridProps): React.JSX.Element {
  const t = useTranslations('pricing');
  const { PRICING_TIERS, MASTER_TIER } = usePricingData();

  return (
    <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {CARD_CONFIGS.map((cfg) => {
        const isMaster = cfg.tier === 'MASTER';
        const tierData = isMaster ? null : PRICING_TIERS.find((p) => p.tier === cfg.tier);
        const basePriceCents = resolveTierBaseCents(cfg.tier, isAnnual, MASTER_TIER.price);
        const discountedPriceCents = calculateDiscount(basePriceCents, appliedDiscount);
        const features = isMaster
          ? MASTER_TIER.features
          : tierData
            ? [...tierData.featureGroups.video, ...tierData.featureGroups.raas]
            : [];

        return (
          <TierCard
            key={cfg.tier}
            config={cfg}
            tierName={isMaster ? MASTER_TIER.name : tierData?.name || cfg.tier}
            description={t(cfg.descriptionKey as Parameters<typeof t>[0])}
            features={features}
            priceCents={basePriceCents}
            discountedCents={discountedPriceCents}
            isAnnual={isAnnual}
            isLoading={loading === cfg.tier}
            locale={locale}
            labels={{
              popular: t('popular'),
              getStarted: t('get_started'),
              contactSales: t('contact_sales'),
              processing: t('processing'),
              perMonth: t('per_month'),
              perYear: t('per_year'),
              masterOneTime: t('master.one_time'),
              billingMonthly: t('billing_monthly'),
              billingYearly: t('billing_yearly'),
            }}
            onSelect={() => onSelectTier(cfg.tier)}
          />
        );
      })}
    </div>
  );
}
