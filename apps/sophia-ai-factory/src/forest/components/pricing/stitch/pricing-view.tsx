/**
 * Pricing View Component
 *
 * Layer: forest/components/pricing/stitch | Max LOC: <= 140
 */

'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import dynamic from 'next/dynamic';
import { usePricingData } from '../pricing-data';
import { CouponInput, type PromoDiscount } from '../coupon-input';
import { useCsrfToken } from '@/seed/security/use-csrf-token';
import { CurrentTierBadge, RefundBanner, CheckoutErrorAlert } from './promo-banner';
import { BillingToggle } from './billing-toggle';
import { PricingTierGrid } from './pricing-tier-grid';
import {
  type BillingPeriod,
  type CheckoutDataState,
  type PricingStitchSectionProps,
} from './types';
import { requestTierCheckout } from './pricing-checkout-helper';

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
  const { MASTER_TIER } = usePricingData();

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

        <PricingTierGrid
          isAnnual={billingPeriod === 'annual'}
          loading={loading}
          locale={locale}
          appliedDiscount={appliedDiscount}
          onSelectTier={handleSelectTier}
        />

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
