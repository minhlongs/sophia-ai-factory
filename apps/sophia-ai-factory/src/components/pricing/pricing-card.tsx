"use client";

import { useTranslations } from "next-intl";
import { FadeInView } from "@/components/ui/fade-in-view";

export function formatPrice(cents: number, locale: string): string {
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
  selected?: boolean;
}

export function PricingCard({
  name,
  description,
  tier,
  monthlyPrice,
  features,
  popular,
  onSelect,
  loading,
  locale,
  selected,
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
        role="radio"
        aria-checked={selected}
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
