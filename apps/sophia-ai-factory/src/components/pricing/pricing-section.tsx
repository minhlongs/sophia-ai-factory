"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { FadeInView } from "@/components/ui/fade-in-view";
import { PricingCard, formatPrice } from "./pricing-card";
import { usePricingData } from "./pricing-data";
import { CouponInput } from "./coupon-input";

interface TierDiscount {
  tier: string;
  discountPercent: number;
  originalPrice: number;
  finalPrice: number;
  checkoutUrl?: string | null;
}

export function PricingSection() {
  const [loading, setLoading] = useState<string | null>(null);
  const [discounts, setDiscounts] = useState<Map<string, TierDiscount>>(new Map());
  const t = useTranslations("landing");
  const locale = useLocale();
  const { PRICING_TIERS, MASTER_TIER } = usePricingData();

  const allTiers = [...PRICING_TIERS.map((p) => p.tier), MASTER_TIER.tier];

  const handleDiscountApplied = (applied: TierDiscount[]) => {
    const map = new Map<string, TierDiscount>();
    applied.forEach((d) => map.set(d.tier, d));
    setDiscounts(map);
  };

  const handleDiscountCleared = () => setDiscounts(new Map());

  const handleSelectTier = async (tier: string) => {
    const discount = discounts.get(tier);

    // 100% off — activate coupon directly
    if (discount && discount.finalPrice === 0) {
      setLoading(tier);
      try {
        const res = await fetch("/api/coupons/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coupon: "FREE50", tier }),
        });
        const data = await res.json();
        if (data.success) {
          window.location.href = `/dashboard?activated=${tier}&bonus=${data.mcuBonus}`;
        } else if (res.status === 401) {
          // Not logged in → login first, then activate
          window.location.href = `/${locale}/login?coupon=FREE50&tier=${tier}&free=1`;
        } else {
          alert(data.error || "Activation failed");
        }
      } catch {
        window.location.href = `/${locale}/login?coupon=FREE50&tier=${tier}&free=1`;
      } finally {
        setLoading(null);
      }
      return;
    }

    // Coupon with discounted checkout URL — redirect directly
    if (discount?.checkoutUrl) {
      window.location.href = discount.checkoutUrl;
      return;
    }

    // Normal checkout (no coupon)
    setLoading(tier);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || t("pricing.error_checkout"));
      }
    } catch {
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

        {/* Coupon input */}
        <div className="mt-8">
          <CouponInput
            tiers={allTiers}
            onDiscountApplied={handleDiscountApplied}
            onDiscountCleared={handleDiscountCleared}
          />
        </div>

        <div className="mt-4 grid gap-8 md:grid-cols-3">
          {PRICING_TIERS.map((pricing) => {
            const discount = discounts.get(pricing.tier);
            return (
              <PricingCard
                key={pricing.tier}
                name={pricing.name}
                description={pricing.description}
                tier={pricing.tier}
                monthlyPrice={pricing.monthlyPrice}
                featureGroups={pricing.featureGroups}
                popular={pricing.popular}
                onSelect={handleSelectTier}
                loading={loading === pricing.tier}
                locale={locale}
                selected={loading === pricing.tier}
                discountedPriceCents={discount ? Math.round(discount.finalPrice * 100) : undefined}
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
                    {discounts.has(MASTER_TIER.tier) ? (
                      <>
                        <span className="text-4xl font-bold text-emerald-400">
                          {formatPrice(Math.round((discounts.get(MASTER_TIER.tier)?.finalPrice ?? 0) * 100), locale)}
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
                  aria-label={`${loading === MASTER_TIER.tier ? 'Processing' : 'Get started with'} ${MASTER_TIER.name} plan`}
                  className="mt-8 w-full md:w-auto rounded-lg bg-gradient-to-r from-primary to-purple-600 px-10 py-4 font-bold text-white text-lg shadow-lg hover:opacity-90 hover:scale-[1.02] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading === MASTER_TIER.tier ? t("pricing.processing") : t("pricing.master.cta")}
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
    </section>
  );
}
