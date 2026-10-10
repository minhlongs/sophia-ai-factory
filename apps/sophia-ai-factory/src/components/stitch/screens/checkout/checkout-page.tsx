'use client';

import React, { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, Loader2 } from 'lucide-react';
import { CheckoutPanel } from '@/forest/components/checkout/checkout-panel';
import { useCheckout } from './use-checkout';
import { PlanSelector } from './plan-selector';
import { PaymentMethods } from './payment-methods';
import { OrderSummary } from './order-summary';

function CheckoutContent() {
  const t = useTranslations('stitch.checkout');
  const {
    locale,
    selectedTier,
    setSelectedTier,
    billingPeriod,
    setBillingPeriod,
    paymentMethod,
    setPaymentMethod,
    couponCode,
    setCouponCode,
    loading,
    errorMessage,
    setErrorMessage,
    checkoutData,
    isCheckoutOpen,
    setIsCheckoutOpen,
    currentTierConfig,
    isMaster,
    effectivePeriod,
    displayPrice,
    handleStartCheckout,
  } = useCheckout();

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Official Billing Gateways</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight mb-2">
            {t('payment.title')}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            {t('payment.subtitle')}
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs underline hover:text-white ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Plan & Options Selector */}
          <div className="lg:col-span-7 space-y-6">
            <PlanSelector
              selectedTier={selectedTier}
              onSelectTier={setSelectedTier}
              billingPeriod={billingPeriod}
              onChangeBillingPeriod={setBillingPeriod}
              isMaster={isMaster}
            />
            <PaymentMethods
              paymentMethod={paymentMethod}
              onSelectPaymentMethod={setPaymentMethod}
              couponCode={couponCode}
              onCouponCodeChange={setCouponCode}
            />
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-5 space-y-6">
            <OrderSummary
              selectedTier={selectedTier}
              tierName={currentTierConfig.name}
              effectivePeriod={effectivePeriod}
              paymentMethod={paymentMethod}
              displayPrice={displayPrice}
              loading={loading}
              onStartCheckout={handleStartCheckout}
            />
          </div>
        </div>
      </div>

      {/* Authentic CheckoutPanel Modal */}
      {checkoutData && (
        <CheckoutPanel
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
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
    </div>
  );
}

export function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}

export default CheckoutPage;
