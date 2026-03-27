"use client";

import { useTranslations } from "next-intl";
import { FadeInView } from "@/components/ui/fade-in-view";
import { FeatureGroups } from "./pricing-data";

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
  featureGroups: FeatureGroups;
  popular?: boolean;
  onSelect: (tier: string) => void;
  loading?: boolean;
  locale: string;
  selected?: boolean;
  /** Discounted price in cents — when set, original price is struck through */
  discountedPriceCents?: number;
}

/** Renders a single feature item with a checkmark icon. */
function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2 text-muted-foreground text-sm">
      <svg
        className="h-4 w-4 shrink-0 text-primary"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      {text}
    </li>
  );
}

export function PricingCard({
  name,
  description,
  tier,
  monthlyPrice,
  featureGroups,
  popular,
  onSelect,
  loading,
  locale,
  selected,
  discountedPriceCents,
}: PricingCardProps) {
  const t = useTranslations("landing");

  return (
    <FadeInView
      duration={500}
      className={`card-hover relative flex flex-col rounded-2xl border p-8 transition-all duration-300 ${
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
          {discountedPriceCents !== undefined ? (
            <>
              <span className="text-3xl font-bold text-emerald-400">
                {formatPrice(discountedPriceCents, locale)}
              </span>
              <span className="text-xl line-through text-muted-foreground/60">
                {formatPrice(monthlyPrice, locale)}
              </span>
            </>
          ) : (
            <span className="text-3xl font-bold text-foreground">
              {formatPrice(monthlyPrice, locale)}
            </span>
          )}
          <span className="text-muted-foreground">{t("pricing.per_month")}</span>
        </div>
        <span className="mt-1 inline-block rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
          {t("pricing.commitment")}
        </span>
      </div>

      {/* ── Video Factory group ── */}
      <div className="mt-6 flex-1">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-400">
          <span aria-hidden="true">🎬</span>
          {t("pricing.features.group_video")}
        </p>
        <ul className="space-y-2">
          {featureGroups.video.map((f) => (
            <FeatureItem key={f} text={f} />
          ))}
        </ul>

        {/* Separator */}
        <div className="my-4 border-t border-border/50" />

        {/* ── AI Automation group ── */}
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-cyan-400">
          <span aria-hidden="true">🤖</span>
          {t("pricing.features.group_raas")}
        </p>
        <ul className="space-y-2">
          {featureGroups.raas.map((f) => (
            <FeatureItem key={f} text={f} />
          ))}
        </ul>
      </div>

      <button
        role="radio"
        aria-checked={selected}
        onClick={() => onSelect(tier)}
        disabled={loading}
        aria-label={`${loading ? "Processing" : "Get started with"} ${name} plan`}
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
