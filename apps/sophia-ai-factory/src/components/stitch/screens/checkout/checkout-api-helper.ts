'use client';

import type { Tier } from '@/seed/types';
import type {
  CheckoutData,
  PaymentMethod,
  EffectivePeriod,
} from './types';

export interface InitiateCheckoutParams {
  selectedTier: Tier;
  effectivePeriod: EffectivePeriod;
  paymentMethod: PaymentMethod;
  couponCode: string;
  basePriceCents: number;
  locale: string;
  csrfHeaders: Record<string, string>;
  onRedirectLogin: (loginUrl: string) => void;
  onUpdateCheckoutData: (data: CheckoutData) => void;
  onSetCheckoutOpen: (open: boolean) => void;
  onError: (message: string) => void;
}

export async function initiateCheckoutRequest({
  selectedTier,
  effectivePeriod,
  paymentMethod,
  couponCode,
  basePriceCents,
  locale,
  csrfHeaders,
  onRedirectLogin,
  onUpdateCheckoutData,
  onSetCheckoutOpen,
  onError,
}: InitiateCheckoutParams): Promise<void> {
  const trimmedCoupon = couponCode.trim();
  const payload: Record<string, unknown> = {
    tier: selectedTier,
    period: effectivePeriod,
    paymentMethod,
  };

  if (trimmedCoupon) {
    payload.promoCode = trimmedCoupon;
  }

  onUpdateCheckoutData({
    tier: selectedTier,
    period: effectivePeriod,
    paymentMethod,
    priceCents: basePriceCents,
    couponCode: trimmedCoupon || undefined,
  });
  onSetCheckoutOpen(true);

  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeaders,
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    onSetCheckoutOpen(false);
    const nextUrl = encodeURIComponent(`/${locale}/checkout?tier=${selectedTier}`);
    onRedirectLogin(`/${locale}/login?next=${nextUrl}`);
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
    onSetCheckoutOpen(false);
    onError(data.error || data.message || 'Unable to initiate payment. Please try again.');
    return;
  }

  onUpdateCheckoutData({
    tier: selectedTier,
    url: data.url,
    orderId: data.orderId,
    period: effectivePeriod,
    paymentMethod,
    priceCents: data.priceCents ?? basePriceCents,
    discountedPriceCents: data.discountedPriceCents,
    couponCode: trimmedCoupon || undefined,
  });
}
