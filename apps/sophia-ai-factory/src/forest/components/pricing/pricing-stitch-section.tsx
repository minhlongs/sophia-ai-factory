"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { UNIFIED_TIERS } from "@/seed/config/tiers";
import { usePricingData } from "./pricing-data";
import { formatPrice } from './pricing-card'
import { CouponInput, type PromoDiscount } from "./coupon-input";
import dynamic from "next/dynamic";
import { useCsrfToken } from "@/seed/security/use-csrf-token";

const CheckoutPanel = dynamic(
  () => import("../checkout/checkout-panel").then((m) => ({ default: m.CheckoutPanel })),
  { ssr: false }
);

type PaymentMethod = "nowpayments" | "payos";
type BillingPeriod = "monthly" | "annual";

interface CheckoutResponse {
  url?: string;
  orderId?: string;
  error?: string;
  redirectTo?: string;
  status?: string;
  handoverId?: string;
  magicLink?: string;
  message?: string;
}

/** Card display configuration for each tier */
interface CardConfig {
  tier: string;
  descriptionKey: string;
  ctaVariant: "ghost" | "primary" | "outline";
  highlighted?: boolean;
  priceSuffixKey: string;
}

const CARD_CONFIGS: CardConfig[] = [
  { tier: "BASIC", descriptionKey: "for_starters", ctaVariant: "ghost", priceSuffixKey: "per_month" },
  { tier: "PREMIUM", descriptionKey: "popular", ctaVariant: "primary", highlighted: true, priceSuffixKey: "per_month" },
  { tier: "ENTERPRISE", descriptionKey: "unlimited_features", ctaVariant: "outline", priceSuffixKey: "per_month" },
  { tier: "MASTER", descriptionKey: "white_label_plan", ctaVariant: "ghost", priceSuffixKey: "one_time_label" },
];

export function PricingStitchSection({ isAuthenticated = false, currentTier }: { isAuthenticated?: boolean; currentTier?: string | null }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  const [appliedDiscount, setAppliedDiscount] = useState<PromoDiscount | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("nowpayments");
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
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const t = useTranslations("pricing");
  const locale = useLocale();
  const csrfHeaders = useCsrfToken();
  const { PRICING_TIERS, MASTER_TIER } = usePricingData();

  const handleDiscountApplied = (discount: PromoDiscount) => {
    setAppliedDiscount(discount);
  };
  const handleDiscountCleared = () => setAppliedDiscount(null);

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

  const handleSelectTier = async (tierKey: string) => {
    setLoading(tierKey);

    if (!isAuthenticated) {
      window.location.href = `/${locale}/login?next=${encodeURIComponent(`/${locale}/pricing`)}`;
      return;
    }

    try {
      const period = tierKey === "MASTER" ? "lifetime" : billingPeriod === "annual" ? "yearly" : "monthly";
      const body: Record<string, unknown> = { tier: tierKey, paymentMethod, period };
      if (appliedDiscount && (appliedDiscount.discountType === "percent_off" || appliedDiscount.discountType === "fixed_off")) {
        body.promoCode = appliedDiscount.code;
      }

      const isAnnual = billingPeriod === "annual";
      const tierConfig = UNIFIED_TIERS[tierKey as keyof typeof UNIFIED_TIERS];
      const annualPriceCents = isAnnual && tierConfig && tierConfig.yearlyPrice > 0
        ? tierConfig.yearlyPrice * 100
        : undefined;

      const pricingInfo = PRICING_TIERS.find((p) => p.tier === tierKey);
      const monthlyPrice = pricingInfo ? pricingInfo.monthlyPrice : 0;

      const baseCents = tierKey === "MASTER"
        ? MASTER_TIER.price
        : isAnnual && annualPriceCents
          ? annualPriceCents
          : monthlyPrice;

      const discountedCents = getDiscountedCents(baseCents);

      setCheckoutData({
        tier: tierKey,
        period: period as "monthly" | "yearly" | "lifetime",
        paymentMethod,
        priceCents: baseCents,
        discountedPriceCents: discountedCents,
        couponCode: appliedDiscount?.code,
      });
      setIsCheckoutOpen(true);
      setCheckoutError(null);

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as CheckoutResponse;

      if (response.status === 401) {
        setIsCheckoutOpen(false);
        window.location.href = `/${locale}/login?next=${encodeURIComponent(`/${locale}/pricing`)}`;
        return;
      }

      if (data.status === "free_order_completed") {
        setIsCheckoutOpen(false);
        if (data.magicLink) {
          window.location.href = data.magicLink;
        } else {
          window.location.href = `/${locale}/payment-success?tier=${tierKey}&order_id=${data.orderId || ''}`;
        }
        return;
      }

      if (data.status === "pending_manual_payment") {
        setIsCheckoutOpen(false);
        setCheckoutError(null);
        return;
      }

      if (data.url) {
        setCheckoutData((prev) => prev ? { ...prev, url: data.url, orderId: data.orderId } : null);
      } else {
        setIsCheckoutOpen(false);
        setCheckoutError(data.error || t("error_checkout"));
      }
    } catch {
      setIsCheckoutOpen(false);
      setCheckoutError(t("error_network"));
    } finally {
      setLoading(null);
    }
  };

  /** Get price in cents for a tier, given billing period */
  function getPriceCents(tierKey: string): number {
    if (tierKey === "MASTER") return MASTER_TIER.price;
    const isAnnual = billingPeriod === "annual";
    const tierConfig = UNIFIED_TIERS[tierKey as keyof typeof UNIFIED_TIERS];
    if (isAnnual && tierConfig && tierConfig.yearlyPrice > 0) {
      return tierConfig.yearlyPrice * 100;
    }
    const pricingInfo = PRICING_TIERS.find((p) => p.tier === tierKey);
    return pricingInfo ? pricingInfo.monthlyPrice : 0;
  }

  /** Get display price string for a tier */
  function getDisplayPrice(tierKey: string): string {
    if (tierKey === "MASTER") return t("custom_price");
    const cents = getPriceCents(tierKey);
    return formatPrice(cents, locale);
  }

  /** Get features list for a tier */
  function getFeatures(tierKey: string): string[] {
    const pricingInfo = PRICING_TIERS.find((p) => p.tier === tierKey);
    if (pricingInfo) {
      return [...(pricingInfo.featureGroups.video || []), ...(pricingInfo.featureGroups.raas || [])];
    }
    if (tierKey === "MASTER") {
      return MASTER_TIER.features;
    }
    return [];
  }

  const isAnnual = billingPeriod === "annual";

  return (
    <section className="py-20 bg-[#0F0F11]" id="pricing">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center">
          <h1 className="text-5xl font-bold text-[#e7e4f0]">
            {t("title")}
          </h1>
          <p className="mt-4 text-lg text-[#A1A1AA]">
            {t("subtitle")}
          </p>
        </div>

        {/* Coupon input */}
        <div className="mt-8 flex justify-center">
          <CouponInput
            onDiscountApplied={handleDiscountApplied}
            onDiscountCleared={handleDiscountCleared}
          />
        </div>

        {/* Billing toggle — Stitch rounded-full style */}
        <div className="mt-8 flex justify-center">
          <div className="inline-flex items-center rounded-full border border-[#484750] bg-[#191920] p-1">
            <button
              type="button"
              role="switch"
              aria-checked={billingPeriod === "monthly"}
              onClick={() => setBillingPeriod("monthly")}
              className={`rounded-full px-6 py-2.5 text-sm font-semibold transition-all duration-200 ${
                billingPeriod === "monthly"
                  ? "bg-primary text-white"
                  : "text-[#A1A1AA] hover:text-white"
              }`}
            >
              {t("monthly_label")}
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={billingPeriod === "annual"}
              onClick={() => setBillingPeriod("annual")}
              className={`relative rounded-full px-6 py-2.5 text-sm font-semibold transition-all duration-200 ${
                billingPeriod === "annual"
                  ? "bg-primary text-white"
                  : "text-[#A1A1AA] hover:text-white"
              }`}
            >
              {t("annual_label")}
              <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                {t("save_percent", { percent: 20 })}
              </span>
            </button>
          </div>
        </div>

        {/* Checkout error */}
        {checkoutError && (
          <div className="mt-6 mx-auto max-w-xl rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-center justify-between">
            <p className="text-sm text-red-400">{checkoutError}</p>
            <button
              onClick={() => setCheckoutError(null)}
              className="text-xs text-red-300 hover:text-red-200 underline ml-4 shrink-0"
            >
              {t("dismiss")}
            </button>
          </div>
        )}

        {/* Current tier badge */}
        {currentTier && (
          <div className="mt-6 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
              {t("current_plan_badge")}: {currentTier}
            </span>
          </div>
        )}

        {/* Pricing cards grid */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {CARD_CONFIGS.map((cfg) => {
            const tierConfig = UNIFIED_TIERS[cfg.tier as keyof typeof UNIFIED_TIERS];
            const features = getFeatures(cfg.tier);
            const priceCents = getPriceCents(cfg.tier);
            const discountedCents = getDiscountedCents(priceCents);
            const isLoading = loading === cfg.tier;

            return (
              <div
                key={cfg.tier}
                className={`relative flex flex-col p-8 transition-all duration-300 ${
                  cfg.highlighted
                    ? "border-2 border-primary bg-[#191920] shadow-xl shadow-primary/20 scale-[1.05] z-10 rounded-lg"
                    : "border border-[#484750] bg-[#191920] hover:border-primary/50 rounded-lg"
                }`}
              >
                {/* Popular badge — Stitch rounded-full style */}
                {cfg.tier === "PREMIUM" && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
                    {t("popular")}
                  </span>
                )}

                {/* Tier name */}
                <h3 className={`text-lg font-semibold ${cfg.tier === "PREMIUM" ? "text-[#e7e4f0]" : "text-[#A1A1AA]"}`}>
                  {cfg.tier === "MASTER" ? MASTER_TIER.name : tierConfig?.name || cfg.tier}
                </h3>

                {/* Description */}
                <p className="mt-1 text-sm text-[#71717A]">
                  {t(cfg.descriptionKey as Parameters<typeof t>[0])}
                </p>

                {/* Price */}
                <div className="mt-4 mb-8">
                  {cfg.tier === "MASTER" ? (
                    <div className="flex items-baseline gap-2">
                      {discountedCents !== undefined ? (
                        <>
                          <span className="text-4xl font-bold text-emerald-400">
                            {formatPrice(discountedCents, locale)}
                          </span>
                          <span className="text-2xl line-through text-[#52525B]">
                            {formatPrice(MASTER_TIER.price, locale)}
                          </span>
                        </>
                      ) : (
                        <span className="text-4xl font-bold text-[#e7e4f0]">
                          {formatPrice(MASTER_TIER.price, locale)}
                        </span>
                      )}
                      <span className="text-sm text-[#71717A]">{t("master.one_time")}</span>
                    </div>
                  ) : isAnnual ? (
                    <div className="flex items-baseline gap-2 flex-wrap">
                      {discountedCents !== undefined ? (
                        <>
                          <span className="text-4xl font-bold text-emerald-400">
                            {formatPrice(discountedCents, locale)}
                          </span>
                          <span className="text-2xl line-through text-[#52525B]">
                            {formatPrice(priceCents, locale)}
                          </span>
                        </>
                      ) : (
                        <span className="text-4xl font-bold text-[#e7e4f0]">
                          {formatPrice(priceCents, locale)}
                        </span>
                      )}
                      <span className="text-sm text-[#71717A]">{t("per_year")}</span>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-2">
                      {discountedCents !== undefined ? (
                        <>
                          <span className="text-4xl font-bold text-emerald-400">
                            {formatPrice(discountedCents, locale)}
                          </span>
                          <span className="text-2xl line-through text-[#52525B]">
                            {formatPrice(priceCents, locale)}
                          </span>
                        </>
                      ) : (
                        <span className="text-4xl font-bold text-[#e7e4f0]">
                          {formatPrice(priceCents, locale)}
                        </span>
                      )}
                      <span className="text-sm text-[#71717A]">{t("per_month")}</span>
                    </div>
                  )}
                </div>

                {/* Features list — Stitch spacing */}
                <ul className="mb-10 flex-1 space-y-4">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-[#A1A1AA]">
                      {/* Filled check_circle SVG matching Material Icons style */}
                      <svg
                        className="mt-0.5 h-[18px] w-[18px] shrink-0 text-primary"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                {cfg.ctaVariant === "primary" ? (
                  <button
                    onClick={() => handleSelectTier(cfg.tier)}
                    disabled={isLoading}
                    className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-bold text-white transition-all duration-200 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? t("processing") : t("get_started")}
                  </button>
                ) : cfg.ctaVariant === "outline" ? (
                  <button
                    onClick={() => handleSelectTier(cfg.tier)}
                    disabled={isLoading}
                    className="w-full rounded-lg border border-primary px-6 py-3 text-sm font-bold text-primary transition-all duration-200 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? t("processing") : t("get_started")}
                  </button>
                ) : (
                  <button
                    onClick={() => handleSelectTier(cfg.tier)}
                    disabled={isLoading}
                    className="w-full rounded-lg border border-[#484750] px-6 py-3 text-sm font-bold text-[#A1A1AA] transition-all duration-200 hover:border-primary/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? t("processing") : cfg.tier === "MASTER" ? t("contact_sales") : t("get_started")}
                  </button>
                )}

                {/* Billing note */}
                {cfg.tier !== "MASTER" && (
                  <p className="mt-3 text-center text-xs text-[#52525B]">
                    {isAnnual ? t("billing_yearly") : t("billing_monthly")}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Refund policy banner — matching card styling */}
        <div className="mt-10 mx-auto max-w-xl rounded-lg border border-[#484750] bg-[#191920] p-4 text-center">
          <p className="text-xs text-[#A1A1AA]">
            <span className="font-semibold text-white">{t("refund_master_title")}</span>{" "}
            {t("refund_master_desc")}
          </p>
        </div>
      </div>

      {/* Checkout panel */}
      {checkoutData && (
        <CheckoutPanel
          isOpen={isCheckoutOpen}
          onClose={() => { setIsCheckoutOpen(false); setCheckoutError(null); }}
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
