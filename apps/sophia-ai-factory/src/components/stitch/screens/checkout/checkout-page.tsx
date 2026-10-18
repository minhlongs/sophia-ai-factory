'use client';

import React, { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { CheckoutHeader } from './checkout-header';
import { CheckoutContent } from './checkout-content';
import { useCheckout } from './use-checkout';

function CheckoutInner() {
  const t = useTranslations('stitch.checkout');
  const {
    locale,
    selectedTier,
    setSelectedTier: setTierRaw,
    billingPeriod,
    setBillingPeriod: setPeriodRaw,
    paymentMethod,
    setPaymentMethod: setMethodRaw,
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

  const setSelectedTier = (tier: typeof selectedTier) => setTierRaw(tier);
  const setBillingPeriod = (period: typeof billingPeriod) => setPeriodRaw(period);
  const setPaymentMethod = (method: typeof paymentMethod) => setMethodRaw(method);

  return (
    <>
      <CheckoutHeader errorMessage={errorMessage} setErrorMessage={setErrorMessage} t={t} />
      <CheckoutContent
        locale={locale}
        selectedTier={selectedTier}
        setSelectedTier={setSelectedTier}
        billingPeriod={billingPeriod}
        setBillingPeriod={setBillingPeriod}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        couponCode={couponCode}
        setCouponCode={setCouponCode}
        loading={loading}
        checkoutData={checkoutData}
        isCheckoutOpen={isCheckoutOpen}
        setIsCheckoutOpen={setIsCheckoutOpen}
        currentTierConfig={currentTierConfig}
        isMaster={isMaster}
        effectivePeriod={effectivePeriod}
        displayPrice={displayPrice}
        handleStartCheckout={handleStartCheckout}
      />
    </>
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
      <CheckoutInner />
    </Suspense>
  );
}

export default CheckoutPage;
