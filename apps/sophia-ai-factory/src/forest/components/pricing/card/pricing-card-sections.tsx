"use client";

// i18n-namespace: landing

/**
 * Pricing Card Sections — Price Header, Feature Groups & Payment Footer
 * Layer: forest/components/pricing/card
 */

import React from "react";
import { useTranslations } from "next-intl";
import { PricingCardProps } from "./types";
import { formatPrice, formatVnd, centsToVnd } from "./currency-formatters";
import { FeatureItem } from "./feature-item";

export interface PricingCardPriceSectionProps {
  isAnnual: boolean;
  monthlyPrice: number;
  annualPriceCents?: number;
  discountedPriceCents?: number;
  locale: string;
  showVnd?: boolean;
  yearlySavingsPercent?: number;
}

export function PricingCardPriceSection({
  isAnnual, monthlyPrice, annualPriceCents, discountedPriceCents, locale, showVnd, yearlySavingsPercent,
}: PricingCardPriceSectionProps) {
  const t = useTranslations("landing");

  return (
    <div className="mt-6">
      {isAnnual ? (
        <>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-3xl font-bold text-emerald-400">
              {formatPrice(discountedPriceCents ?? annualPriceCents!, locale)}
            </span>
            {discountedPriceCents !== undefined && (
              <span className="text-xl line-through text-muted-foreground/60">
                {formatPrice(annualPriceCents!, locale)}
              </span>
            )}
            <span className="text-muted-foreground">{t("pricing.per_year")}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("pricing.per_month_equiv", {
              amount: formatPrice(Math.round((discountedPriceCents ?? annualPriceCents!) / 12), locale),
            })}
          </p>
          <span className="mt-1 inline-block rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">
            {t("pricing.save_percent", { percent: yearlySavingsPercent ?? 17 })}
          </span>
        </>
      ) : (
        <div className="flex items-baseline gap-2">
          {discountedPriceCents !== undefined ? (
            <>
              <span className="text-3xl font-bold text-emerald-400">{formatPrice(discountedPriceCents, locale)}</span>
              <span className="text-xl line-through text-muted-foreground/60">{formatPrice(monthlyPrice, locale)}</span>
            </>
          ) : (
            <span className="text-3xl font-bold text-foreground">{formatPrice(monthlyPrice, locale)}</span>
          )}
          <span className="text-muted-foreground">{t("pricing.per_month")}</span>
        </div>
      )}
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
  );
}

export interface PricingCardFeaturesSectionProps {
  featureGroups: PricingCardProps["featureGroups"];
}

export function PricingCardFeaturesSection({ featureGroups }: PricingCardFeaturesSectionProps) {
  const t = useTranslations("landing");

  return (
    <div className="mt-6 flex-1">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
        <span aria-hidden="true">🎬</span>
        {t("pricing.features.group_video")}
      </p>
      <ul className="space-y-2">
        {featureGroups.video.map((f) => <FeatureItem key={f} text={f} />)}
      </ul>

      <div className="my-4 border-t border-border/50" />

      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
        <span aria-hidden="true">🤖</span>
        {t("pricing.features.group_raas")}
      </p>
      <ul className="space-y-2">
        {featureGroups.raas.map((f) => <FeatureItem key={f} text={f} />)}
      </ul>
    </div>
  );
}
