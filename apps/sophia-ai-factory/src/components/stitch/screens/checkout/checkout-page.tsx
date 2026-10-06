'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, ShieldCheck, Lock, Sparkles, QrCode, ArrowRight, Loader2, Tag } from 'lucide-react';
import { Button, Card, CardHeader, CardContent, Input, Badge } from '@/components/stitch';
import { CheckoutPanel } from '@/forest/components/checkout/checkout-panel';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import { useCsrfToken } from '@/seed/security/use-csrf-token';
import type { Tier } from '@/seed/types';

interface CheckoutData {
  tier: string;
  url?: string;
  orderId?: string;
  period: 'monthly' | 'yearly' | 'lifetime';
  paymentMethod: 'nowpayments' | 'payos';
  priceCents: number;
  discountedPriceCents?: number;
  couponCode?: string;
}

const TIER_ORDER: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];

function CheckoutContent() {
  const t = useTranslations('stitch.checkout');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const csrfHeaders = useCsrfToken();

  const initialTierParam = searchParams.get('tier')?.toUpperCase() as Tier | undefined;
  const initialTier: Tier = initialTierParam && UNIFIED_TIERS[initialTierParam] ? initialTierParam : 'PREMIUM';

  const [selectedTier, setSelectedTier] = useState<Tier>(initialTier);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<'nowpayments' | 'payos'>('nowpayments');
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [checkoutData, setCheckoutData] = useState<CheckoutData | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Sync selected tier from URL if search params change
  useEffect(() => {
    const tierFromUrl = searchParams.get('tier')?.toUpperCase() as Tier | undefined;
    if (tierFromUrl && UNIFIED_TIERS[tierFromUrl]) {
      setSelectedTier(tierFromUrl);
    }
  }, [searchParams]);

  const currentTierConfig = UNIFIED_TIERS[selectedTier];
  const isMaster = selectedTier === 'MASTER';
  const effectivePeriod: 'monthly' | 'yearly' | 'lifetime' = isMaster
    ? 'lifetime'
    : billingPeriod === 'yearly'
      ? 'yearly'
      : 'monthly';

  // Calculate pricing
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

      // Pre-open checkout panel to provide immediate responsive feedback
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

      const data = await res.json() as {
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

      // Update with authentic invoice URL and order ID from NOWPayments/PayOS
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
            {/* Step 1: Select Plan */}
            <Card padding="lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">1. Choose Your Plan</h2>
                {/* Billing toggle */}
                {!isMaster && (
                  <div className="flex items-center p-0.5 rounded-lg bg-muted text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setBillingPeriod('monthly')}
                      className={`px-3 py-1 rounded-md transition-all ${
                        billingPeriod === 'monthly'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingPeriod('yearly')}
                      className={`px-3 py-1 rounded-md transition-all flex items-center gap-1 ${
                        billingPeriod === 'yearly'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span>Yearly</span>
                      <span className="text-[10px] text-emerald-400 font-bold">-17%</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TIER_ORDER.map((tierKey) => {
                  const cfg = UNIFIED_TIERS[tierKey];
                  const isSelected = selectedTier === tierKey;
                  const price = tierKey === 'MASTER'
                    ? cfg.price
                    : billingPeriod === 'yearly'
                      ? cfg.yearlyPrice
                      : cfg.price;
                  const periodSuffix = tierKey === 'MASTER' ? 'lifetime' : billingPeriod === 'yearly' ? '/yr' : '/mo';

                  return (
                    <div
                      key={tierKey}
                      onClick={() => setSelectedTier(tierKey)}
                      className={`
                        p-4 rounded-xl cursor-pointer border-2 transition-all flex flex-col justify-between
                        ${isSelected
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-border bg-card/50 hover:bg-muted/50'
                        }
                      `}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-foreground text-sm">{cfg.name}</span>
                          {tierKey === 'PREMIUM' && (
                            <Badge variant="soft" color="primary" className="text-[10px] bg-primary/20 text-primary border-0">
                              Popular
                            </Badge>
                          )}
                          {tierKey === 'MASTER' && (
                            <Badge variant="soft" color="warning" className="text-[10px] bg-amber-500/20 text-amber-300 border-0">
                              Lifetime
                            </Badge>
                          )}
                        </div>
                        <p className="text-2xl font-black text-foreground">
                          ${price}
                          <span className="text-xs font-normal text-muted-foreground ml-1">
                            {periodSuffix}
                          </span>
                        </p>
                      </div>

                      <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground flex items-center justify-between">
                        <span>{cfg.mcuMonthly.toLocaleString()} MCU / mo</span>
                        {isSelected && <Check className="w-4 h-4 text-primary" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Step 2: Payment Rail */}
            <Card padding="lg">
              <h2 className="text-lg font-bold text-foreground mb-4">2. Select Payment Rail</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* NOWPayments USDT */}
                <div
                  onClick={() => setPaymentMethod('nowpayments')}
                  className={`
                    p-4 rounded-xl cursor-pointer border-2 transition-all
                    ${paymentMethod === 'nowpayments'
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border bg-card/50 hover:bg-muted/50'
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-foreground text-sm flex items-center gap-2">
                      <Lock className="w-4 h-4 text-primary" />
                      NOWPayments (USDT)
                    </span>
                    {paymentMethod === 'nowpayments' && <Check className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    TRC20, Polygon & Arbitrum with near-zero gas fees. Global instant confirmation.
                  </p>
                </div>

                {/* PayOS VietQR */}
                <div
                  onClick={() => setPaymentMethod('payos')}
                  className={`
                    p-4 rounded-xl cursor-pointer border-2 transition-all
                    ${paymentMethod === 'payos'
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border bg-card/50 hover:bg-muted/50'
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-foreground text-sm flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-emerald-400" />
                      PayOS (VietQR 24/7)
                    </span>
                    {paymentMethod === 'payos' && <Check className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Napas 247 chuyển khoản ngân hàng Việt Nam. Quét mã QR thanh toán tức thì.
                  </p>
                </div>
              </div>
            </Card>

            {/* Step 3: Promo / Voucher */}
            <Card padding="lg">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Promo Code or Voucher</h2>
              </div>
              <div className="flex gap-2">
                <Input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Enter coupon code (e.g. VIP2026)"
                  className="uppercase text-sm"
                />
              </div>
            </Card>
          </div>

          {/* Order Summary & Proceed Button */}
          <div className="lg:col-span-5 space-y-6">
            <Card padding="lg" className="sticky top-24">
              <CardHeader className="!p-0 mb-4">
                <h2 className="text-lg font-bold text-foreground">{t('payment.orderSummary')}</h2>
                <p className="text-xs text-muted-foreground">Review your selection before proceeding</p>
              </CardHeader>

              <CardContent className="!p-0 space-y-4">
                <div className="rounded-xl bg-muted/40 p-4 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Selected Tier</span>
                    <span className="font-bold text-foreground">{currentTierConfig.name} ({selectedTier})</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Billing Period</span>
                    <span className="font-medium text-foreground capitalize">{effectivePeriod}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Payment Method</span>
                    <span className="font-medium text-foreground">
                      {paymentMethod === 'nowpayments' ? 'NOWPayments USDT' : 'PayOS VietQR'}
                    </span>
                  </div>
                  <div className="border-t border-border pt-3 flex justify-between items-center">
                    <span className="text-base font-bold text-foreground">{t('payment.total')}</span>
                    <span className="text-2xl font-black text-primary">${displayPrice}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 text-emerald-400 font-medium">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Protected by Sophia Smart Contract Escrow</span>
                  </div>
                  <p>
                    Automatic activation via NOWPayments TRC20/Polygon IPN or PayOS webhook within seconds of blockchain / bank settlement.
                  </p>
                </div>

                <Button
                  onClick={handleStartCheckout}
                  disabled={loading}
                  fullWidth
                  size="lg"
                  className="h-12 text-base font-bold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {t('payment.processing')}
                    </>
                  ) : (
                    <>
                      <span>Proceed to Payment</span>
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Authentic CheckoutPanel Modal */}
      {checkoutData && (
        <CheckoutPanel
          isOpen={isCheckoutOpen}
          onClose={() => {
            setIsCheckoutOpen(false);
          }}
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

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
