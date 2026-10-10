'use client';

/**
 * Bundle Purchase Actions & Pending Purchase Banner
 *
 * Layer: forest/components/pricing/bundle-card
 */

import React from 'react';
import type { PendingPurchase } from './types';

interface BundleActionsProps {
  label: string;
  lang: 'vi' | 'en';
  skuId: string;
  pendingPurchase: PendingPurchase | null;
  onClearPending: () => void;
  onBuy: () => void;
  isDisabled: boolean;
  ctaText: string;
  error: string | null;
  locale: string;
}

export function BundleActions({
  label,
  lang,
  skuId,
  pendingPurchase,
  onClearPending,
  onBuy,
  isDisabled,
  ctaText,
  error,
  locale,
}: BundleActionsProps) {
  return (
    <>
      {/* P0.5: Pending purchase banner */}
      {pendingPurchase && pendingPurchase.skuId === skuId && (
        <div
          role="status"
          className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300"
        >
          <p className="font-semibold">
            {lang === "vi"
              ? "Bạn có giao dịch chưa hoàn thành"
              : "You have a pending purchase"}
          </p>
          <p className="mt-1 text-xs text-amber-400/80">
            {lang === "vi"
              ? "Hoàn tất thanh toán hoặc hủy để mua mới."
              : "Complete payment or cancel to start a new one."}
          </p>
          <div className="mt-2 flex gap-2">
            <a
              href={pendingPurchase.paymentUrl}
              className="rounded bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/30"
            >
              {lang === "vi" ? "Tiếp tục thanh toán" : "Continue payment"}
            </a>
            <button
              onClick={onClearPending}
              className="rounded bg-transparent px-3 py-1 text-xs text-amber-400/60 hover:text-amber-400"
            >
              {lang === "vi" ? "Hủy & mua mới" : "Cancel & buy new"}
            </button>
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={onBuy}
        disabled={isDisabled}
        aria-label={lang === "vi" ? `Mua ${label}` : `Buy ${label}`}
        className="mt-8 w-full rounded-lg bg-emerald-500 py-3 font-semibold text-white transition-all duration-300 hover:bg-emerald-400 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {ctaText}
      </button>

      {/* Error message */}
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-400"
        >
          {error}
          {/* Login link for 401 errors */}
          {error.includes("đăng nhập") || error.includes("log in") ? (
            <a
              href={`/${locale}/login?redirect=/${locale}/pricing`}
              className="ml-1 underline hover:text-red-300"
            >
              {lang === "vi" ? "Đăng nhập" : "Login"}
            </a>
          ) : null}
        </p>
      )}
    </>
  );
}
