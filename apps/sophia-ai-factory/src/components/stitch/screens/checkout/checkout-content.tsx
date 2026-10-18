'use client';

import { CheckoutPanel } from '@/forest/components/checkout/checkout-panel';
import { PlanSelector } from './plan-selector';
import { PaymentMethods } from './payment-methods';
import { OrderSummary } from './order-summary';
import type { Tier, PaymentMethod, BillingPeriod, EffectivePeriod, CheckoutData } from './types';
import type { UnifiedTierLimits } from '@/seed/config/tiers/unified-limits';

interface CheckoutContentProps {
  locale: string;
  selectedTier: Tier;
  setSelectedTier: (tier: Tier) => void;
  billingPeriod: BillingPeriod;
  setBillingPeriod: (period: BillingPeriod) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
  couponCode: string;
  setCouponCode: (code: string) => void;
  loading: boolean;
  checkoutData: CheckoutData | null;
  isCheckoutOpen: boolean;
  setIsCheckoutOpen: (open: boolean) => void;
  currentTierConfig: UnifiedTierLimits;
  isMaster: boolean;
  effectivePeriod: EffectivePeriod;
  displayPrice: number;
  handleStartCheckout: (e?: React.FormEvent) => Promise<void>;
}

export function CheckoutContent({
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
  checkoutData,
  isCheckoutOpen,
  setIsCheckoutOpen,
  currentTierConfig,
  isMaster,
  effectivePeriod,
  displayPrice,
  handleStartCheckout,
}: CheckoutContentProps) {
  return (
    <div className="max-w-5xl mx-auto">
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
    </div>
  );
}
