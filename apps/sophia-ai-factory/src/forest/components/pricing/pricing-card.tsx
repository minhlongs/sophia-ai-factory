"use client";

import { useTranslations } from "next-intl";
import { FadeInView } from "@/seed/components/ui/fade-in-view";
import { FeatureGroups } from "./pricing-data";

export function formatPrice(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * Format VND amount for display (e.g. "4.975.000 ₫").
 * Receives VND integer (not cents).
 */
export function formatVnd(vnd: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(vnd);
}

/** Pinned display exchange rate. Runtime conversions use USD_TO_VND env var in payos.ts. */
export const USD_TO_VND_DISPLAY = 25500;

/** Convert USD cents to VND, rounded to nearest 1,000 VND. */
export function centsToVnd(cents: number): number {
  const usd = cents / 100;
  return Math.round((usd * USD_TO_VND_DISPLAY) / 1000) * 1000;
}

interface PricingCardProps {
  name: string;
  description: string;
  tier: string;
  /** Monthly price in cents — always the base for per-month equivalence display */
  monthlyPrice: number;
  /**
   * Annual price in cents — when provided, the card switches to annual display.
   * Undefined means monthly mode is active.
   */
  annualPriceCents?: number;
  /** Controls which period label (/yr vs /mo) is shown */
  billingPeriod?: "monthly" | "annual";
  featureGroups: FeatureGroups;
  popular?: boolean;
  onSelect: (tier: string) => void;
  loading?: boolean;
  locale: string;
  selected?: boolean;
  /** Discounted price in cents — when set, original price is struck through */
  discountedPriceCents?: number;
  /** When true, show VND equivalent below the USD price */
  showVnd?: boolean;
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
  annualPriceCents,
  billingPeriod = "monthly",
  featureGroups,
  popular,
  onSelect,
  loading,
  locale,
  selected,
  discountedPriceCents,
  showVnd,
}: PricingCardProps) {
  const t = useTranslations("landing");
  const isAnnual = billingPeriod === "annual" && annualPriceCents !== undefined;

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
        {isAnnual ? (
          /* ── Annual billing display ── */
          <>
            <div className="flex items-baseline gap-2 flex-wrap">
              {discountedPriceCents !== undefined ? (
                <>
                  <span className="text-3xl font-bold text-emerald-400">
                    {formatPrice(discountedPriceCents, locale)}
                  </span>
                  <span className="text-xl line-through text-muted-foreground/60">
                    {formatPrice(annualPriceCents!, locale)}
                  </span>
                </>
              ) : (
                <span className="text-3xl font-bold text-emerald-400">
                  {formatPrice(annualPriceCents!, locale)}
                </span>
              )}
              <span className="text-muted-foreground">{t("pricing.per_year")}</span>
            </div>
            {/* Per-month equivalent */}
            <p className="mt-1 text-xs text-muted-foreground">
              {t("pricing.per_month_equiv", {
                amount: formatPrice(Math.round((discountedPriceCents ?? annualPriceCents!) / 12), locale),
              })}
            </p>
            {/* Save badge */}
            <span className="mt-1 inline-block rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">
              {t("pricing.save_percent", { percent: 17 })}
            </span>
          </>
        ) : (
          /* ── Monthly billing display ── */
          <>
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
          </>
        )}
        {/* VND equivalent — shown when PayOS (bank transfer) is selected */}
        {showVnd && (
          <p className="mt-1 text-xs text-amber-400/80">
            ≈ {formatVnd(centsToVnd(discountedPriceCents ?? (isAnnual ? annualPriceCents! : monthlyPrice)))}
            {isAnnual ? "/năm" : "/tháng"}
          </p>
        )}
        {!isAnnual && (
          <span className="mt-1 inline-block rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
            {t("pricing.commitment")}
          </span>
        )}
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
        aria-label={`${loading ? "Processing" : "Subscribe to"} ${name} plan`}
        className={`mt-8 w-full rounded-lg py-3 font-semibold transition-all duration-300 ${
          popular
            ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02]"
            : "bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30 hover:scale-[1.02]"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {loading ? t("pricing.processing") : t("pricing.subscribe_now")}
      </button>
    </FadeInView>
  );
}
