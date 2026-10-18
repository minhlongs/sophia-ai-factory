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
import { BundleCardHeader, resolveBundleCtaLabel } from './bundle-card-header';

const STARTER = ONE_TIME_SKUS.STARTER_BUNDLE;

export function OneTimeBundleCardView({
  sku = STARTER,
  userId,
  heygenHealthy = true,
}: OneTimeBundleCardProps) {
  const locale = useLocale() as 'vi' | 'en';
  const lang: 'vi' | 'en' = locale === 'vi' ? 'vi' : 'en';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPurchase, setPendingPurchase] = useState<PendingPurchase | null>(null);

  const label = lang === 'vi' ? sku.label_vi : sku.label_en;
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
      const res = await fetch('/api/payments/one-time-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        lang === 'vi'
          ? 'Không thể kết nối. Kiểm tra kết nối mạng và thử lại'
          : 'Network error. Check your connection and try again',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClearPending = () => {
    clearPendingPurchase();
    setPendingPurchase(null);
  };

  const isDisabled = loading || !heygenHealthy;

  return (
    <FadeInView
      duration={500}
      className="relative flex flex-col rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-8 transition-all duration-300 hover:border-emerald-400/60 hover:shadow-lg hover:shadow-emerald-500/10"
    >
      <BundleCardHeader lang={lang} sku={sku} />

      <BundleFeatures label={label} features={features} />

      <BundleActions
        label={label}
        lang={lang}
        skuId={sku.id}
        pendingPurchase={pendingPurchase}
        onClearPending={handleClearPending}
        onBuy={handleBuy}
        isDisabled={isDisabled}
        ctaText={resolveBundleCtaLabel(lang, heygenHealthy, loading)}
        error={error}
        locale={locale}
      />
    </FadeInView>
  );
}
