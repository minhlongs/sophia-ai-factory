"use client";

/**
 * Custom hook encapsulating PricingSectionView state and tier checkout workflow.
 * @module forest/components/pricing/section/use-pricing-checkout
 */

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useCsrfToken } from "@/seed/security/use-csrf-token";
import { usePricingData } from "../pricing-data";
import type { PromoDiscount } from "../coupon-input";
import type { BillingPeriod, PaymentMethod, CheckoutData } from "./types";
import {
  calculateDiscountedCents,
  prepareTierCheckoutInit,
  postCheckoutRequest,
} from "./pricing-checkout-helpers";

export function usePricingCheckout(isAuthenticated: boolean) {
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
        window.location.href =
          data.magicLink || `/${locale}/payment-success?tier=${tier}&order_id=${data.orderId || ""}`;
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

  return {
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
  };
}
