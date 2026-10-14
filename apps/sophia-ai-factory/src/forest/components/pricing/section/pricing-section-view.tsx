"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useCsrfToken } from "@/seed/security/use-csrf-token";
import { usePricingData } from "../pricing-data";
import { CouponInput, type PromoDiscount } from "../coupon-input";
import dynamic from "next/dynamic";
import { BillingIntervalSwitch } from "./billing-interval-switch";
import { PaymentMethodSwitch } from "./payment-method-switch";
import { PricingTierGrid } from "./pricing-tier-grid";
import { MasterTierCard } from "./master-tier-card";
import { RefundPolicyBanner } from "./refund-policy-banner";
import { CheckoutErrorAlert } from "./checkout-error-alert";
import type { BillingPeriod, PaymentMethod, CheckoutData, PricingSectionProps } from "./types";
import {
  calculateDiscountedCents,
  prepareTierCheckoutInit,
  postCheckoutRequest,
} from "./pricing-checkout-helpers";

const CheckoutPanel = dynamic(
  () => import("@/forest/components/checkout/checkout-panel").then((m) => ({ default: m.CheckoutPanel })),
  { ssr: false }
);

export function PricingSectionView({ isAuthenticated = false }: PricingSectionProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<PromoDiscount | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("nowpayments");
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const t = useTranslations("landing");
  const locale = useLocale();
  const csrfHeaders = useCsrfToken();
  const { PRICING_TIERS, MASTER_TIER } = usePricingData();

  const getDiscountedCents = (basePriceCents: number) =>
    calculateDiscountedCents(basePriceCents, appliedDiscount);

  const handleSelectTier = async (tier: string) => {
    setLoading(tier);
    if (!isAuthenticated) {
      window.location.href = `/${locale}/login?next=${encodeURIComponent(`/${locale}/pricing`)}`;
      return;
    }

    try {
      const { body, initialCheckoutData } = prepareTierCheckoutInit({
        tier,
        billingPeriod,
        paymentMethod,
        appliedDiscount,
        pricingTiers: PRICING_TIERS,
        masterTierPrice: MASTER_TIER.price,
      });

      setCheckoutData(initialCheckoutData);
      setIsCheckoutOpen(true);
      setCheckoutError(null);

      const { status, data } = await postCheckoutRequest(body, csrfHeaders);
      if (status === 401) {
        setIsCheckoutOpen(false);
        window.location.href = `/${locale}/login?next=${encodeURIComponent(`/${locale}/pricing`)}`;
        return;
      }

      if (data.status === "free_order_completed") {
        setIsCheckoutOpen(false);
        window.location.href = data.magicLink || `/${locale}/payment-success?tier=${tier}&order_id=${data.orderId || ""}`;
        return;
      }

      if (data.status === "pending_manual_payment") {
        setIsCheckoutOpen(false);
        setCheckoutError(null);
        alert(data.message || t("pricing.offline_payment_received"));
        return;
      }

      if (data.url) {
        setCheckoutData((prev) => (prev ? { ...prev, url: data.url, orderId: data.orderId } : null));
      } else {
        setIsCheckoutOpen(false);
        setCheckoutError(data.error || t("pricing.error_checkout"));
      }
    } catch {
      setIsCheckoutOpen(false);
      setCheckoutError(t("pricing.error_network"));
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="py-20 bg-background" id="pricing">
      <div className="mx-auto max-w-7xl px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl">{t("pricing.title")}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{t("pricing.subtitle")}</p>
        </div>

        <div className="mt-8">
          <CouponInput
            onDiscountApplied={(discount) => setAppliedDiscount(discount)}
            onDiscountCleared={() => setAppliedDiscount(null)}
          />
        </div>

        <BillingIntervalSwitch billingPeriod={billingPeriod} onPeriodChange={setBillingPeriod} />
        <PaymentMethodSwitch paymentMethod={paymentMethod} onMethodChange={setPaymentMethod} />

        {checkoutError && (
          <CheckoutErrorAlert error={checkoutError} onDismiss={() => setCheckoutError(null)} />
        )}

        <RefundPolicyBanner />

        <PricingTierGrid
          pricingTiers={PRICING_TIERS} billingPeriod={billingPeriod} paymentMethod={paymentMethod}
          loadingTier={loading} locale={locale} getDiscountedCents={getDiscountedCents} onSelectTier={handleSelectTier}
        />

        <MasterTierCard
          name={MASTER_TIER.name} description={MASTER_TIER.description} tier={MASTER_TIER.tier}
          price={MASTER_TIER.price} features={MASTER_TIER.features} locale={locale}
          discountedPrice={getDiscountedCents(MASTER_TIER.price)} paymentMethod={paymentMethod}
          loading={loading === MASTER_TIER.tier} onSelectTier={handleSelectTier}
        />
      </div>

      {checkoutData && (
        <CheckoutPanel
          isOpen={isCheckoutOpen}
          onClose={() => { setIsCheckoutOpen(false); setCheckoutError(null); }}
          tier={checkoutData.tier} priceCents={checkoutData.priceCents}
          discountedPriceCents={checkoutData.discountedPriceCents} period={checkoutData.period}
          paymentMethod={checkoutData.paymentMethod} couponCode={checkoutData.couponCode}
          checkoutUrl={checkoutData.url} orderId={checkoutData.orderId} locale={locale}
        />
      )}
    </section>
  );
}
