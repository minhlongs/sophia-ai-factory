"use client";

import { useTranslations } from "next-intl";
import { FadeInView } from "@/seed/components/ui/fade-in-view";
import { formatPrice, formatVnd, centsToVnd } from "../pricing-card";

interface MasterTierCardProps {
  name: string;
  description: string;
  tier: string;
  price: number;
  features: string[];
  locale: string;
  discountedPrice?: number;
  paymentMethod: "nowpayments" | "payos";
  loading: boolean;
  onSelectTier: (tier: string) => void;
}

export function MasterTierCard({
  name,
  description,
  tier,
  price,
  features,
  locale,
  discountedPrice,
  paymentMethod,
  loading,
  onSelectTier,
}: MasterTierCardProps) {
  const t = useTranslations("landing");
  const effectivePrice = discountedPrice !== undefined ? discountedPrice : price;

  return (
    <FadeInView className="mt-16 relative" duration={500}>
      <div className="rounded-2xl border-2 border-primary bg-gradient-to-br from-primary/10 via-background to-primary/5 p-8 md:p-12 shadow-xl shadow-primary/10 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20">
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-purple-600 px-6 py-1.5 text-sm font-bold text-white shadow-lg">
          ⚡ {t("pricing.master.best_value")}
        </span>
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h3 className="text-2xl font-bold text-foreground md:text-3xl">{name}</h3>
            <p className="mt-2 text-muted-foreground">{description}</p>
            <div className="mt-6">
              <div className="flex items-baseline gap-2">
                {discountedPrice !== undefined ? (
                  <>
                    <span className="text-4xl font-bold text-emerald-400">
                      {formatPrice(discountedPrice, locale)}
                    </span>
                    <span className="text-2xl line-through text-muted-foreground/60">
                      {formatPrice(price, locale)}
                    </span>
                  </>
                ) : (
                  <span className="text-4xl font-bold text-foreground">
                    {formatPrice(price, locale)}
                  </span>
                )}
                <span className="text-muted-foreground">{t("pricing.master.one_time")}</span>
              </div>
              {paymentMethod === "payos" && (
                <p className="mt-1 text-xs text-amber-400/80">
                  ≈ {formatVnd(centsToVnd(effectivePrice))} {t("pricing.one_time_label")}
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
              aria-checked={loading}
              onClick={() => onSelectTier(tier)}
              disabled={loading}
              aria-label={`${loading ? "Processing" : "Get started with"} ${name} plan`}
              className="mt-8 w-full md:w-auto rounded-lg bg-gradient-to-r from-primary to-purple-600 px-10 py-4 font-bold text-white text-lg shadow-lg hover:opacity-90 hover:scale-[1.02] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? t("pricing.processing") : t("pricing.subscribe_now_master")}
            </button>
          </div>
          <ul className="space-y-3">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-foreground">
                <svg
                  className="h-5 w-5 text-primary flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </FadeInView>
  );
}
