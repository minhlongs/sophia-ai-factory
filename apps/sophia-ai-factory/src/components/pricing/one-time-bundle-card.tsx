"use client";

/**
 * OneTimeBundleCard — pricing card for one-time bundle purchases.
 * Bilingual (Vi/En) via next-intl useLocale.
 * Tone-matches existing pricing cards (Tailwind 4 classes).
 *
 * @module components/pricing/one-time-bundle-card
 */

import { useState } from "react";
import { useLocale } from "next-intl";
import { FadeInView } from "@/components/ui/fade-in-view";
import { ONE_TIME_SKUS } from "@/config/one-time-skus";
import type { OneTimeSku } from "@/types";

const STARTER = ONE_TIME_SKUS.STARTER_BUNDLE;

interface OneTimeBundleCardProps {
  /** Override SKU — defaults to STARTER_BUNDLE */
  sku?: OneTimeSku;
  /** User id for order_id in checkout URL */
  userId?: string;
}

function CheckIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0 text-emerald-400"
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
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2 text-sm text-muted-foreground">
      <CheckIcon />
      {text}
    </li>
  );
}

const FEATURES: Record<"vi" | "en", string[]> = {
  vi: [
    "10 video AI — trả một lần, dùng mãi",
    "Hiệu lực 12 tháng từ ngày thanh toán",
    "Không phí hàng tháng",
    "Giao video tự động sau thanh toán",
    "Dashboard theo dõi số dư credits",
    "Upgrade lên gói hàng tháng bất kỳ lúc nào",
  ],
  en: [
    "10 AI videos — pay once, keep forever",
    "12-month validity from purchase date",
    "No monthly fees",
    "Auto video delivery after payment",
    "Dashboard credit balance tracking",
    "Upgrade to a monthly plan any time",
  ],
};

export function OneTimeBundleCard({ sku = STARTER, userId }: OneTimeBundleCardProps) {
  const locale = useLocale() as "vi" | "en";
  const lang: "vi" | "en" = locale === "vi" ? "vi" : "en";
  const [loading, setLoading] = useState(false);

  const label = lang === "vi" ? sku.label_vi : sku.label_en;
  const features = FEATURES[lang];

  const handleBuy = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/payments/one-time-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skuId: sku.id, userId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoading(false);
    }
  };

  const title_vi = "Gói Mua Lẻ";
  const title_en = "One-Time Bundle";
  const description_vi = "Mua credits, dùng khi cần — không ràng buộc hàng tháng";
  const description_en = "Buy credits, use when needed — no monthly commitment";
  const cta_vi = loading ? "Đang xử lý..." : "Mua ngay";
  const cta_en = loading ? "Processing..." : "Buy now";
  const badge_vi = "Trả một lần";
  const badge_en = "One-time";

  return (
    <FadeInView
      duration={500}
      className="relative flex flex-col rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-8 transition-all duration-300 hover:border-emerald-400/60 hover:shadow-lg hover:shadow-emerald-500/10"
    >
      {/* Badge */}
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-4 py-1 text-xs font-semibold text-emerald-300">
        {lang === "vi" ? badge_vi : badge_en}
      </span>

      <h3 className="text-xl font-bold text-foreground">
        {lang === "vi" ? title_vi : title_en}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {lang === "vi" ? description_vi : description_en}
      </p>

      {/* Price */}
      <div className="mt-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-emerald-400">
            ${sku.priceUsd}
          </span>
          <span className="text-muted-foreground">USD</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {lang === "vi"
            ? `${sku.credits} video · Hiệu lực ${sku.ttlMonths} tháng`
            : `${sku.credits} videos · ${sku.ttlMonths}-month validity`}
        </p>
      </div>

      {/* Features */}
      <div className="mt-6 flex-1">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-400">
          <span aria-hidden="true">&#x1F4E6;</span>
          {lang === "vi" ? label : label}
        </p>
        <ul className="space-y-2">
          {features.map((f) => (
            <FeatureItem key={f} text={f} />
          ))}
        </ul>
      </div>

      {/* CTA */}
      <button
        onClick={handleBuy}
        disabled={loading}
        aria-label={lang === "vi" ? `Mua ${label}` : `Buy ${label}`}
        className="mt-8 w-full rounded-lg bg-emerald-500 py-3 font-semibold text-white transition-all duration-300 hover:bg-emerald-400 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {lang === "vi" ? cta_vi : cta_en}
      </button>
    </FadeInView>
  );
}
