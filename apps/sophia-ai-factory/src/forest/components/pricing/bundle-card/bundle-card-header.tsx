'use client';

/**
 * Header and Price section for OneTimeBundleCardView
 *
 * Layer: forest/components/pricing/bundle-card
 */

import React from 'react';
import { ONE_TIME_SKUS } from '@/seed/config/one-time-skus';
import type { OneTimeBundleCardProps } from './types';

type SkuConfig = NonNullable<OneTimeBundleCardProps['sku']> | typeof ONE_TIME_SKUS.STARTER_BUNDLE;

interface BundleCardHeaderProps {
  lang: 'vi' | 'en';
  sku: SkuConfig;
}

export function BundleCardHeader({ lang, sku }: BundleCardHeaderProps) {
  const title = lang === 'vi' ? 'Gói Mua Lẻ' : 'One-Time Bundle';
  const description =
    lang === 'vi'
      ? 'Mua credits, dùng khi cần — không ràng buộc hàng tháng'
      : 'Buy credits, use when needed — no monthly commitment';
  const badge = lang === 'vi' ? 'Trả một lần' : 'One-time';

  return (
    <>
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-4 py-1 text-xs font-semibold text-emerald-300">
        {badge}
      </span>

      <h3 className="text-xl font-bold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>

      <div className="mt-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-emerald-400">
            ${sku.priceUsd}
          </span>
          <span className="text-muted-foreground">USD</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {lang === 'vi'
            ? `${sku.credits} video · Hiệu lực ${sku.ttlMonths} tháng`
            : `${sku.credits} videos · ${sku.ttlMonths}-month validity`}
        </p>
      </div>
    </>
  );
}

export function resolveBundleCtaLabel(
  lang: 'vi' | 'en',
  heygenHealthy: boolean,
  loading: boolean,
): string {
  if (!heygenHealthy) {
    return lang === 'vi'
      ? 'Đang bảo trì hệ thống — vui lòng quay lại sau'
      : 'Service temporarily unavailable — try again later';
  }
  if (loading) {
    return lang === 'vi' ? 'Đang xử lý...' : 'Processing...';
  }
  return lang === 'vi' ? 'Mua ngay' : 'Buy now';
}
