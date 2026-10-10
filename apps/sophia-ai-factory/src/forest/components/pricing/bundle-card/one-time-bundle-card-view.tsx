'use client';

/**
 * OneTimeBundleCardView — visual pricing card layout
 *
 * Layer: forest/components/pricing/bundle-card
 */

import React, { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { FadeInView } from '@/seed/components/ui/fade-in-view';
import { ONE_TIME_SKUS } from '@/seed/config/one-time-skus';
import type { OneTimeBundleCardProps, PendingPurchase } from './types';
import { BUNDLE_FEATURES } from './types';
import {
  readPendingPurchase,
  writePendingPurchase,
  clearPendingPurchase,
  errorMessageFor,
} from './bundle-storage';
import { BundleFeatures } from './bundle-features';
import { BundleActions } from './bundle-actions';

const STARTER = ONE_TIME_SKUS.STARTER_BUNDLE;

export function OneTimeBundleCardView({
  sku = STARTER,
  userId,
  heygenHealthy = true,
}: OneTimeBundleCardProps) {
  const locale = useLocale() as "vi" | "en";
  const lang: "vi" | "en" = locale === "vi" ? "vi" : "en";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPurchase, setPendingPurchase] = useState<PendingPurchase | null>(null);

  const label = lang === "vi" ? sku.label_vi : sku.label_en;
  const features = BUNDLE_FEATURES[lang];

  useEffect(() => {
    setPendingPurchase(readPendingPurchase());
  }, []);

  const handleBuy = async () => {
    if (loading || !heygenHealthy) return;

    const existing = readPendingPurchase();
    if (existing && existing.skuId === sku.id) {
      window.location.href = existing.paymentUrl;
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/one-time-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skuId: sku.id, userId }),
      });
      if (!res.ok) {
        const errorBody = (await res.json().catch(() => ({}))) as { error?: string };
        setError(errorMessageFor(res.status, errorBody.error, lang));
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        writePendingPurchase(data.url, sku.id);
        window.location.href = data.url;
      }
    } catch {
      setError(
        lang === "vi"
          ? "Không thể kết nối. Kiểm tra kết nối mạng và thử lại"
          : "Network error. Check your connection and try again"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClearPending = () => {
    clearPendingPurchase();
    setPendingPurchase(null);
  };

  const title_vi = "Gói Mua Lẻ";
  const title_en = "One-Time Bundle";
  const description_vi = "Mua credits, dùng khi cần — không ràng buộc hàng tháng";
  const description_en = "Buy credits, use when needed — no monthly commitment";
  const badge_vi = "Trả một lần";
  const badge_en = "One-time";

  const isDisabled = loading || !heygenHealthy;

  const getCtaLabel = () => {
    if (!heygenHealthy) {
      return lang === "vi"
        ? "Đang bảo trì hệ thống — vui lòng quay lại sau"
        : "Service temporarily unavailable — try again later";
    }
    if (loading) {
      return lang === "vi" ? "Đang xử lý..." : "Processing...";
    }
    return lang === "vi" ? "Mua ngay" : "Buy now";
  };

  return (
    <FadeInView
      duration={500}
      className="relative flex flex-col rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-8 transition-all duration-300 hover:border-emerald-400/60 hover:shadow-lg hover:shadow-emerald-500/10"
    >
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-4 py-1 text-xs font-semibold text-emerald-300">
        {lang === "vi" ? badge_vi : badge_en}
      </span>

      <h3 className="text-xl font-bold text-foreground">
        {lang === "vi" ? title_vi : title_en}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {lang === "vi" ? description_vi : description_en}
      </p>

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

      <BundleFeatures label={label} features={features} />

      <BundleActions
        label={label}
        lang={lang}
        skuId={sku.id}
        pendingPurchase={pendingPurchase}
        onClearPending={handleClearPending}
        onBuy={handleBuy}
        isDisabled={isDisabled}
        ctaText={getCtaLabel()}
        error={error}
        locale={locale}
      />
    </FadeInView>
  );
}
