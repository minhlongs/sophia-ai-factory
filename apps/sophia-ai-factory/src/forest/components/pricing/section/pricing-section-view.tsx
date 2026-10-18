"use client";

import dynamic from "next/dynamic";
import { CouponInput } from "../coupon-input";
import { BillingIntervalSwitch } from "./billing-interval-switch";
import { PaymentMethodSwitch } from "./payment-method-switch";
import { PricingTierGrid } from "./pricing-tier-grid";
import { MasterTierCard } from "./master-tier-card";
import { RefundPolicyBanner } from "./refund-policy-banner";
import { CheckoutErrorAlert } from "./checkout-error-alert";
import type { PricingSectionProps } from "./types";
import { usePricingCheckout } from "./use-pricing-checkout";

const CheckoutPanel = dynamic(
  () => import("@/forest/components/checkout/checkout-panel").then((m) => ({ default: m.CheckoutPanel })),
  { ssr: false }
);

export function PricingSectionView({ isAuthenticated = false }: PricingSectionProps) {
  const {
    loading,
    setAppliedDiscount,
    paymentMethod,
    setPaymentMethod,
    billingPeriod,
    setBillingPeriod,
    checkoutData,
    isCheckoutOpen,
    setIsCheckoutOpen,
    checkoutError,
    setCheckoutError,
    t,
    locale,
    PRICING_TIERS,
    MASTER_TIER,
    getDiscountedCents,
    handleSelectTier,
  } = usePricingCheckout(isAuthenticated);

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
