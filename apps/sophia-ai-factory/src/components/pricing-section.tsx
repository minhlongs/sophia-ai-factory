"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { FadeInView } from "@/components/ui/fade-in-view";

function formatPrice(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

interface PricingCardProps {
  name: string;
  description: string;
  tier: string;
  monthlyPrice: number;
  features: string[];
  popular?: boolean;
  onSelect: (tier: string) => void;
  loading?: boolean;
  locale: string;
}

function PricingCard({
  name,
  description,
  tier,
  monthlyPrice,
  features,
  popular,
  onSelect,
  loading,
  locale,
}: PricingCardProps) {
  const t = useTranslations("landing");

  return (
    <FadeInView
      duration={500}
      className={`relative flex flex-col rounded-2xl border p-8 transition-all duration-300 hover:-translate-y-2 ${
        popular
          ? "border-primary bg-primary/5 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30"
          : "border-border bg-card hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
      }`}
    >
      {popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-sm font-semibold text-primary-foreground">
          {t("pricing.popular")}
        </span>
      )}
      <h3 className="text-xl font-bold text-foreground">{name}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>

      <div className="mt-6">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-foreground">
            {formatPrice(monthlyPrice, locale)}
          </span>
          <span className="text-muted-foreground">{t("pricing.per_month")}</span>
        </div>
        <span className="mt-1 inline-block rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
          {t("pricing.commitment")}
        </span>
      </div>

      <ul className="mt-6 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-muted-foreground">
            <svg
              className="h-5 w-5 text-primary"
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
            {feature}
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(tier)}
        disabled={loading}
        aria-label={`${loading ? 'Processing' : 'Get started with'} ${name} plan`}
        className={`mt-8 w-full rounded-lg py-3 font-semibold transition-all duration-300 ${
          popular
            ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02]"
            : "bg-muted text-foreground hover:bg-muted/80 hover:scale-[1.02]"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {loading ? t("pricing.processing") : t("pricing.get_started")}
      </button>
    </FadeInView>
  );
}

export function PricingSection() {
  const [loading, setLoading] = useState<string | null>(null);
  const t = useTranslations("landing");
  const locale = useLocale();

  // Option D: Single monthly subscription with 12-month commitment
  const PRICING_TIERS = [
    {
      name: t("pricing.tiers.starter.name"),
      description: t("pricing.tiers.starter.description"),
      tier: "BASIC",
      monthlyPrice: 19900, // $199/mo
      features: [
        t("pricing.features.templates_5"),
        t("pricing.features.auto_discovery"),
        t("pricing.features.basic_analytics"),
        t("pricing.features.email_support"),
      ],
    },
    {
      name: t("pricing.tiers.growth.name"),
      description: t("pricing.tiers.growth.description"),
      tier: "PREMIUM",
      monthlyPrice: 39900, // $399/mo
      features: [
        t("pricing.features.unlimited_templates"),
        t("pricing.features.advanced_analytics"),
        t("pricing.features.roi_calculator"),
        t("pricing.features.priority_support"),
        t("pricing.features.custom_brand"),
      ],
      popular: true,
    },
    {
      name: t("pricing.tiers.premium.name"),
      description: t("pricing.tiers.premium.description"),
      tier: "ENTERPRISE",
      monthlyPrice: 79900, // $799/mo
      features: [
        t("pricing.features.custom_templates"),
        t("pricing.features.white_label"),
        t("pricing.features.founder_access"),
        t("pricing.features.api_access"),
        t("pricing.features.uptime_sla"),
      ],
    },
  ];

  // Binh Phap upsell: Master one-time package
  const MASTER_TIER = {
    name: t("pricing.tiers.master.name"),
    description: t("pricing.tiers.master.description"),
    tier: "MASTER",
    price: 499900, // $4,999 one-time
    features: [
      t("pricing.features.everything_premium"),
      t("pricing.features.lifetime_access"),
      t("pricing.features.onboarding"),
      t("pricing.features.vip_support"),
      t("pricing.features.custom_scripts"),
      t("pricing.features.strategy_review"),
      t("pricing.features.white_label_license"),
      t("pricing.features.early_access"),
    ],
  };

  const handleSelectTier = async (tier: string) => {
    setLoading(tier);
    try {
      // Checkout will handle both one-time setup and monthly subscription
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
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {PRICING_TIERS.map((pricing) => (
            <PricingCard
              key={pricing.tier}
              name={pricing.name}
              description={pricing.description}
              tier={pricing.tier}
              monthlyPrice={pricing.monthlyPrice}
              features={pricing.features}
              popular={pricing.popular}
              onSelect={handleSelectTier}
              loading={loading === pricing.tier}
              locale={locale}
            />
          ))}
        </div>

        {/* Binh Phap Master Upsell */}
        <FadeInView
          className="mt-16 relative"
          duration={500}
        >
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
                    <span className="text-4xl font-bold text-foreground">
                      {formatPrice(MASTER_TIER.price, locale)}
                    </span>
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
