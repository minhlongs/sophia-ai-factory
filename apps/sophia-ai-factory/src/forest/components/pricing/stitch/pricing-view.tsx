/**
 * Pricing View Component
 *
 * Layer: forest/components/pricing/stitch | Max LOC: < 200
 */

'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import dynamic from 'next/dynamic';
import { usePricingData } from '../pricing-data';
import { CouponInput, type PromoDiscount } from '../coupon-input';
import { useCsrfToken } from '@/seed/security/use-csrf-token';
import { TierCard } from './tier-card';
import { CurrentTierBadge, RefundBanner, CheckoutErrorAlert } from './promo-banner';
import { BillingToggle } from './billing-toggle';
import {
  CARD_CONFIGS,
  type BillingPeriod,
  type CheckoutDataState,
  type PricingStitchSectionProps,
} from './types';
import {
  calculateDiscount,
  resolveTierBaseCents,
  requestTierCheckout,
} from './pricing-checkout-helper';

const CheckoutPanel = dynamic(
  () => import('../../checkout/checkout-panel').then((m) => ({ default: m.CheckoutPanel })),
  { ssr: false }
);

export function PricingStitchSection({
  isAuthenticated = false,
  currentTier = null,
}: PricingStitchSectionProps): React.JSX.Element {
  const t = useTranslations('pricing');
  const locale = useLocale();
  const csrfHeaders = useCsrfToken();
  const { PRICING_TIERS, MASTER_TIER } = usePricingData();

  const [loading, setLoading] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [appliedDiscount, setAppliedDiscount] = useState<PromoDiscount | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutData, setCheckoutData] = useState<CheckoutDataState | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  async function handleSelectTier(tierKey: string) {
    setLoading(tierKey);
    if (!isAuthenticated) {
      window.location.href = `/${locale}/login?next=${encodeURIComponent(`/${locale}/pricing`)}`;
      return;
    }

    try {
      const nextCheckout = await requestTierCheckout({
        tierKey, billingPeriod, appliedDiscount, csrfHeaders, masterTierPrice: MASTER_TIER.price,
      });
      setCheckoutData(nextCheckout);
      setIsCheckoutOpen(true);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : t('error_checkout'));
    } finally {
      setLoading(null);
    }
  }

  const isAnnual = billingPeriod === 'annual';

  return (
    <section className="py-20 bg-[#0F0F11]" id="pricing">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-[#e7e4f0]">{t('title')}</h1>
          <p className="mt-4 text-lg text-[#A1A1AA]">{t('subtitle')}</p>
        </div>

        <div className="mt-8 flex justify-center">
          <CouponInput onDiscountApplied={setAppliedDiscount} onDiscountCleared={() => setAppliedDiscount(null)} />
        </div>
        <BillingToggle
          billingPeriod={billingPeriod}
          onPeriodChange={setBillingPeriod}
          monthlyLabel={t('monthly_label')}
          annualLabel={t('annual_label')}
          savePercentLabel={t('save_percent', { percent: 20 })}
        />
        <CheckoutErrorAlert error={checkoutError} dismissText={t('dismiss')} onDismiss={() => setCheckoutError(null)} />
        <CurrentTierBadge currentTier={currentTier} label={t('current_plan_badge')} />

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
                onSelect={() => handleSelectTier(cfg.tier)}
              />
            );
          })}
        </div>

        <RefundBanner title={t('refund_master_title')} description={t('refund_master_desc')} />
      </div>

      {checkoutData && (
        <CheckoutPanel
          isOpen={isCheckoutOpen}
          onClose={() => { setIsCheckoutOpen(false); setCheckoutError(null); }}
          tier={checkoutData.tier}
          priceCents={checkoutData.priceCents}
          discountedPriceCents={checkoutData.discountedPriceCents}
          period={checkoutData.period}
          paymentMethod={checkoutData.paymentMethod}
          couponCode={checkoutData.couponCode}
          checkoutUrl={checkoutData.url}
          orderId={checkoutData.orderId}
          locale={locale}
        />
      )}
    </section>
  );
}