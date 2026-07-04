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
  /** Yearly savings percentage (e.g. 17 for 17%). Used in the save badge when billing is annual. */
  yearlySavingsPercent?: number;
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
  yearlySavingsPercent,
}: PricingCardProps) {
  const t = useTranslations("landing");
  const isAnnual = billingPeriod === "annual" && annualPriceCents !== undefined;

  return (
    <FadeInView
      duration={500}
      className={`card-hover relative flex flex-col rounded-2xl border p-8 transition-all duration-300 backdrop-blur-md shadow-2xl ${
        popular
          ? "border-primary-500/50 bg-gradient-to-b from-violet-600/[0.08] to-violet-950/[0.04] shadow-violet-500/10 hover:shadow-violet-500/25 hover:border-primary-400 hover:scale-[1.02]"
          : "border-border bg-gradient-to-b from-muted/30 to-muted/10 hover:border-primary/30 hover:shadow-primary/5 hover:scale-[1.01]"
      }`}
    >
      {popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 shadow-md shadow-violet-500/30 px-4 py-1 text-sm font-semibold text-white">
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
              {t("pricing.save_percent", { percent: yearlySavingsPercent ?? 17 })}
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
            {isAnnual ? t("pricing.per_year_short") : t("pricing.per_month_short")}
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
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
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
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
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
        className={`mt-8 w-full rounded-lg py-3 font-semibold transition-all duration-300 active:scale-[0.98] ${
          popular
            ? "bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white shadow-lg shadow-violet-500/25 hover:scale-[1.02]"
            : "bg-muted/30 hover:bg-muted/50 text-foreground border border-border hover:border-border hover:scale-[1.02]"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {loading ? t("pricing.processing") : t("pricing.subscribe_now")}
      </button>

      {/* ── Secure Payment & Trust Seals ── */}
      <div className="mt-4 flex flex-col items-center gap-2 border-t border-border/50 pt-4">
        <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
          Secure Crypto & Card Checkout
        </p>
        <div className="flex items-center gap-2.5 opacity-60 hover:opacity-90 transition-opacity">
          <span className="text-xs bg-primary/5 border border-primary/10 px-1.5 py-0.5 rounded text-primary font-bold">
            NOWPayments
          </span>
          <svg className="h-3.5 w-auto text-muted-foreground" viewBox="0 0 24 15" fill="currentColor">
            <path d="M10.1 9.3l.9-5.4h1.5l-.9 5.4H10.1zm4.7-5.4c-.3-.1-.8-.2-1.3-.2-1.3 0-2.3.7-2.3 1.7 0 .7.6 1.1 1.1 1.4.5.3.7.4.7.7 0 .4-.5.6-1 .6-.6 0-1.1-.2-1.4-.4l-.2-.1-.2 1.2c.3.1.9.3 1.5.3 1.4 0 2.3-.7 2.3-1.8 0-.6-.4-1.1-1.2-1.4-.5-.2-.8-.4-.8-.7 0-.3.4-.6.9-.6.5 0 .9.1 1.2.3l.1.1.3-1.2zm3.3.7l.8 2.2.1.3.1-.3.5-2.2h1.5l-1.3 5.4h-1.4l-.8-3.4-.1-.4-.1.4-.9 3.4H15l-1.4-5.4h1.5l.8 2.2.1.3.1-.3.5-2.2h1.5zm-11.4 0H5.2c-.3 0-.6.2-.7.5l-2 4.9h1.5l.3-.8h1.8c.1.4.2.8.2.8h1.3L6.7 4.6zm-1.3 3.1l.6-1.7.1-.3.1.3.3 1.7H5.4z"/>
          </svg>
          <svg className="h-3.5 w-auto text-muted-foreground" viewBox="0 0 24 15" fill="currentColor">
            <path d="M12.2 2.1c-.8.8-1.2 1.9-1.2 3.1 0 1.2.4 2.3 1.2 3.1.8-.8 1.2-1.9 1.2-3.1 0-1.2-.4-2.3-1.2-3.1z"/>
            <circle cx="8.3" cy="5.2" r="3.2" opacity="0.6"/>
            <circle cx="15.7" cy="5.2" r="3.2" opacity="0.6"/>
          </svg>
          <span className="text-xs bg-emerald-400/15 border border-emerald-400/20 px-1 rounded text-emerald-400 font-bold">
            USDT
          </span>
          <span className="text-xs bg-amber-400/15 border border-amber-400/20 px-1 rounded text-amber-400 font-bold">
            BTC
          </span>
        </div>
      </div>
    </FadeInView>
  );
}
