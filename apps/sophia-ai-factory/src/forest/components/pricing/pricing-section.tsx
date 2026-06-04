"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { FadeInView } from "@/seed/components/ui/fade-in-view";
import { PricingCard, formatPrice, formatVnd, centsToVnd } from "./pricing-card";
import { UNIFIED_TIERS } from "@/seed/config/tiers";
import { usePricingData } from "./pricing-data";
import { CouponInput, type PromoDiscount } from "./coupon-input";
import { CheckoutPanel } from "../checkout/checkout-panel";
import { Check } from "lucide-react";

type PaymentMethod = "nowpayments" | "payos";
type BillingPeriod = "monthly" | "annual";

interface CheckoutResponse {
  url?: string;
  orderId?: string;
  error?: string;
  redirectTo?: string;
}

export function PricingSection() {
  const [loading, setLoading] = useState<string | null>(null);
  const [appliedDiscount, setAppliedDiscount] = useState<PromoDiscount | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("nowpayments");
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  const [checkoutData, setCheckoutData] = useState<{
    tier: string;
    url?: string;
    orderId?: string;
    period: "monthly" | "yearly" | "lifetime";
    paymentMethod: "nowpayments" | "payos";
    priceCents: number;
    discountedPriceCents?: number;
    couponCode?: string;
  } | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const t = useTranslations("landing");
  const locale = useLocale();
  const { PRICING_TIERS, MASTER_TIER } = usePricingData();

  const handleDiscountApplied = (discount: PromoDiscount) => {
    setAppliedDiscount(discount);
  };

  const handleDiscountCleared = () => setAppliedDiscount(null);

  /** Calculate discounted price in cents for a tier */
  function getDiscountedCents(basePriceCents: number): number | undefined {
    if (!appliedDiscount) return undefined;
    if (appliedDiscount.appliesToTier && appliedDiscount.discountType !== "free_trial" && appliedDiscount.discountType !== "free_full") {
      return undefined;
    }
    if (appliedDiscount.discountType === "percent_off") {
      return Math.max(0, Math.round(basePriceCents * (1 - appliedDiscount.discountValue / 100)));
    }
    if (appliedDiscount.discountType === "fixed_off") {
      return Math.max(0, basePriceCents - appliedDiscount.discountValue);
    }
    return undefined;
  }

  const handleSelectTier = async (tier: string) => {
    setLoading(tier);
    try {
      // MASTER is always lifetime — never send 'annual' for it
      const period = tier === "MASTER" ? "lifetime" : billingPeriod === "annual" ? "yearly" : "monthly";
      const body: Record<string, unknown> = { tier, paymentMethod, period };
      if (appliedDiscount && (appliedDiscount.discountType === "percent_off" || appliedDiscount.discountType === "fixed_off")) {
        body.promoCode = appliedDiscount.code;
      }

      const isAnnual = billingPeriod === "annual";
      const tierConfig = UNIFIED_TIERS[tier as keyof typeof UNIFIED_TIERS];
      const annualPriceCents = isAnnual && tierConfig && tierConfig.yearlyPrice > 0
        ? tierConfig.yearlyPrice * 100
        : undefined;

      const pricing = PRICING_TIERS.find((p) => p.tier === tier);
      const monthlyPrice = pricing ? pricing.monthlyPrice : 0;
      
      const baseCents = tier === "MASTER"
        ? MASTER_TIER.price
        : isAnnual && annualPriceCents 
        ? annualPriceCents 
        : monthlyPrice;

      const discountedCents = getDiscountedCents(baseCents);

      // Open checkout drawer with initial values to make UI feel instant
      setCheckoutData({
        tier,
        period: period as "monthly" | "yearly" | "lifetime",
        paymentMethod,
        priceCents: baseCents,
        discountedPriceCents: discountedCents,
        couponCode: appliedDiscount?.code,
      });
      setIsCheckoutOpen(true);

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as CheckoutResponse;

      if (response.status === 401 && data.redirectTo) {
        setIsCheckoutOpen(false);
        window.location.href = data.redirectTo;
        return;
      }

      if (data.url) {
        // Update checkout modal with generated url/orderId
        setCheckoutData((prev) => prev ? {
          ...prev,
          url: data.url,
          orderId: data.orderId,
        } : null);
      } else {
        setIsCheckoutOpen(false);
        alert(data.error || t("pricing.error_checkout"));
      }
    } catch {
      setIsCheckoutOpen(false);
      alert(t("pricing.error_network"));
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="py-20 bg-background" id="pricing">
      <div className="mx-auto max-w-7xl px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
            {t("pricing.title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t("pricing.subtitle")}
          </p>
        </div>

        {/* Promo code input */}
        <div className="mt-8">
          <CouponInput
            onDiscountApplied={handleDiscountApplied}
            onDiscountCleared={handleDiscountCleared}
          />
        </div>

        {/* ── Billing period toggle (Monthly / Annual) ──────────────────────────── */}
        <div className="mt-6 flex justify-center">
          <div className="inline-flex items-center rounded-xl border border-violet-500/20 bg-card p-1 gap-1 shadow-[0_0_15px_rgba(139,92,246,0.12)]">
            <button
              type="button"
              onClick={() => setBillingPeriod("monthly")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                billingPeriod === "monthly"
                  ? "bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow shadow-violet-500/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("pricing.monthly_label")}
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod("annual")}
              className={`relative rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                billingPeriod === "annual"
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow shadow-emerald-500/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("pricing.annual_label")}
              <span className="ml-2 rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-xs font-semibold text-emerald-300">
                {t("pricing.save_percent", { percent: 17 })}
              </span>
            </button>
          </div>
        </div>

        {/* ── Payment method selector ──────────────────────────────────────────── */}
        <div className="mt-6 flex justify-center">
          <div className="inline-flex rounded-xl border border-violet-500/20 bg-card p-1 gap-1 shadow-[0_0_15px_rgba(139,92,246,0.12)]">
            <button
              type="button"
              onClick={() => setPaymentMethod("nowpayments")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                paymentMethod === "nowpayments"
                  ? "bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow shadow-violet-500/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              💎 Pay with Crypto (USDT)
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("payos")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
                paymentMethod === "payos"
                  ? "bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow shadow-amber-500/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              🏦 Chuyển khoản VND
            </button>
          </div>
        </div>
        {paymentMethod === "payos" ? (
          <p className="mt-2 text-center text-xs text-amber-400/70">
            Thanh toán qua ngân hàng nội địa Việt Nam — QR code + chuyển khoản
          </p>
        ) : (
          <p className="mt-2 text-center text-xs text-violet-400/70">
            Secure, global checkout using NOWPayments USDT & Crypto Gateway
          </p>
        )}

        {/* ── 100% Risk-Free Refund Policy Banner ── */}
        <div className="mt-8 mx-auto max-w-xl rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-950/20 via-violet-900/10 to-cyan-950/20 p-4 text-center shadow-lg backdrop-blur-sm">
          <p className="flex items-center justify-center gap-2 text-xs md:text-sm text-zinc-300">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <Check className="h-3 w-3" />
            </span>
 <span className="font-semibold text-zinc-100">{t("pricing.refund_master_title")}</span> {t("pricing.refund_master_desc")}
          </p>
        </div>

        <div className="mt-4 grid gap-8 md:grid-cols-3">
          {PRICING_TIERS.map((pricing) => {
            const tierConfig = UNIFIED_TIERS[pricing.tier as keyof typeof UNIFIED_TIERS];
            const isAnnual = billingPeriod === "annual";
            // Annual price is stored as whole dollars; convert to cents for display helpers
            const annualPriceCents = isAnnual && tierConfig.yearlyPrice > 0
              ? tierConfig.yearlyPrice * 100
              : undefined;
            const baseCents = isAnnual && annualPriceCents ? annualPriceCents : pricing.monthlyPrice;
            const discountedCents = getDiscountedCents(baseCents);
            return (
              <PricingCard
                key={pricing.tier}
                name={pricing.name}
                description={pricing.description}
                tier={pricing.tier}
                monthlyPrice={pricing.monthlyPrice}
                annualPriceCents={annualPriceCents}
                billingPeriod={billingPeriod}
                featureGroups={pricing.featureGroups}
                popular={pricing.popular}
                onSelect={handleSelectTier}
                loading={loading === pricing.tier}
                locale={locale}
                selected={loading === pricing.tier}
                discountedPriceCents={discountedCents}
                showVnd={paymentMethod === "payos"}
              />
            );
          })}
        </div>

        <FadeInView className="mt-16 relative" duration={500}>
          <div className="rounded-2xl border-2 border-primary bg-gradient-to-br from-primary/10 via-background to-primary/5 p-8 md:p-12 shadow-xl shadow-primary/10 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20">
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-purple-600 px-6 py-1.5 text-sm font-bold text-white shadow-lg">
              ⚡ {t("pricing.master.best_value")}
            </span>
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-2xl font-bold text-foreground md:text-3xl">
                  {MASTER_TIER.name}
                </h3>
                <p className="mt-2 text-muted-foreground">
                  {MASTER_TIER.description}
                </p>
                <div className="mt-6">
                  <div className="flex items-baseline gap-2">
                    {appliedDiscount && getDiscountedCents(MASTER_TIER.price) !== undefined ? (
                      <>
                        <span className="text-4xl font-bold text-emerald-400">
                          {formatPrice(getDiscountedCents(MASTER_TIER.price)!, locale)}
                        </span>
                        <span className="text-2xl line-through text-muted-foreground/60">
                          {formatPrice(MASTER_TIER.price, locale)}
                        </span>
                      </>
                    ) : (
                      <span className="text-4xl font-bold text-foreground">
                        {formatPrice(MASTER_TIER.price, locale)}
                      </span>
                    )}
                    <span className="text-muted-foreground">{t("pricing.master.one_time")}</span>
                  </div>
                  {/* VND equivalent for MASTER tier */}
                  {paymentMethod === "payos" && (
                    <p className="mt-1 text-xs text-amber-400/80">
                      ≈ {formatVnd(centsToVnd(getDiscountedCents(MASTER_TIER.price) ?? MASTER_TIER.price))} một lần
                    </p>
                  )}
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="line-through">{t("pricing.master.compare_price")}</span>{" "}
                    <span className="text-primary font-semibold">
                      {t("pricing.master.compare_label")}
                    </span>
                  </p>
                </div>
                <button
                  role="radio"
                  aria-checked={loading === MASTER_TIER.tier}
                  onClick={() => handleSelectTier(MASTER_TIER.tier)}
                  disabled={loading === MASTER_TIER.tier}
                  aria-label={`${loading === MASTER_TIER.tier ? "Processing" : "Get started with"} ${MASTER_TIER.name} plan`}
                  className="mt-8 w-full md:w-auto rounded-lg bg-gradient-to-r from-primary to-purple-600 px-10 py-4 font-bold text-white text-lg shadow-lg hover:opacity-90 hover:scale-[1.02] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading === MASTER_TIER.tier ? t("pricing.processing") : t("pricing.subscribe_now_master")}
                </button>
              </div>
              <ul className="space-y-3">
                {MASTER_TIER.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-foreground">
                    <svg
                      className="h-5 w-5 text-primary flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="font-medium">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </FadeInView>
      </div>

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
    </section>
  );
}
