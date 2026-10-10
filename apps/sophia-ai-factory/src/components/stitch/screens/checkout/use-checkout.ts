'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import { useCsrfToken } from '@/seed/security/use-csrf-token';
import type { Tier } from '@/seed/types';
import type {
  CheckoutData,
  PaymentMethod,
  BillingPeriod,
  EffectivePeriod,
} from './types';

export function useCheckout() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const csrfHeaders = useCsrfToken();

  const initialTierParam = searchParams.get('tier')?.toUpperCase() as Tier | undefined;
  const initialTier: Tier =
    initialTierParam && UNIFIED_TIERS[initialTierParam] ? initialTierParam : 'PREMIUM';

  const [selectedTier, setSelectedTier] = useState<Tier>(initialTier);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('nowpayments');
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  useEffect(() => {
    const tierFromUrl = searchParams.get('tier')?.toUpperCase() as Tier | undefined;
    if (tierFromUrl && UNIFIED_TIERS[tierFromUrl]) {
      setSelectedTier(tierFromUrl);
    }
  }, [searchParams]);

  const currentTierConfig = UNIFIED_TIERS[selectedTier];
  const isMaster = selectedTier === 'MASTER';
  const effectivePeriod: EffectivePeriod = isMaster
    ? 'lifetime'
    : billingPeriod === 'yearly'
      ? 'yearly'
      : 'monthly';

  const basePriceCents = isMaster
    ? currentTierConfig.priceInCents
    : effectivePeriod === 'yearly'
      ? currentTierConfig.yearlyPrice * 100
      : currentTierConfig.priceInCents;

  const displayPrice = basePriceCents / 100;

  const handleStartCheckout = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const payload: Record<string, unknown> = {
        tier: selectedTier,
        period: effectivePeriod,
        paymentMethod,
      };

      if (couponCode.trim()) {
        payload.promoCode = couponCode.trim();
      }

      setCheckoutData({
        tier: selectedTier,
        period: effectivePeriod,
        paymentMethod,
        priceCents: basePriceCents,
        couponCode: couponCode.trim() || undefined,
      });
      setIsCheckoutOpen(true);

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeaders,
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        setIsCheckoutOpen(false);
        const nextUrl = encodeURIComponent(`/${locale}/checkout?tier=${selectedTier}`);
        router.push(`/${locale}/login?next=${nextUrl}`);
        return;
      }

      const data = (await res.json()) as {
        success?: boolean;
        url?: string;
        orderId?: string;
        priceCents?: number;
        discountedPriceCents?: number;
        message?: string;
        error?: string;
      };

      if (!res.ok) {
        setIsCheckoutOpen(false);
        setErrorMessage(data.error || data.message || 'Unable to initiate payment. Please try again.');
        return;
      }

      setCheckoutData({
        tier: selectedTier,
        url: data.url,
        orderId: data.orderId,
        period: effectivePeriod,
        paymentMethod,
        priceCents: data.priceCents ?? basePriceCents,
        discountedPriceCents: data.discountedPriceCents,
        couponCode: couponCode.trim() || undefined,
      });
    } catch (err) {
      setIsCheckoutOpen(false);
      setErrorMessage(err instanceof Error ? err.message : 'Network error initiating checkout');
    } finally {
      setLoading(false);
    }
  };

  return {
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
  };
}
