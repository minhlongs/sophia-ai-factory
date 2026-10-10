/**
 * Promo and Refund Policy Banners
 *
 * Layer: forest/components/pricing/stitch
 */

'use client';

import React from 'react';

interface CurrentTierBadgeProps {
  currentTier: string | null | undefined;
  label: string;
}

export function CurrentTierBadge({ currentTier, label }: CurrentTierBadgeProps) {
  if (!currentTier) return null;
  return (
    <div className="mt-6 flex justify-center">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
        {label}: {currentTier}
      </span>
    </div>
  );
}

interface RefundBannerProps {
  title: string;
  description: string;
}

export function RefundBanner({ title, description }: RefundBannerProps) {
  return (
    <div className="mt-10 mx-auto max-w-xl rounded-lg border border-[#484750] bg-[#191920] p-4 text-center">
      <p className="text-xs text-[#A1A1AA]">
        <span className="font-semibold text-white">{title}</span> {description}
      </p>
    </div>
  );
}

interface CheckoutErrorAlertProps {
  error: string | null;
  dismissText: string;
  onDismiss: () => void;
}

export function CheckoutErrorAlert({ error, dismissText, onDismiss }: CheckoutErrorAlertProps) {
  if (!error) return null;
  return (
    <div className="mt-6 mx-auto max-w-xl rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-center justify-between">
      <p className="text-sm text-red-400">{error}</p>
      <button
        onClick={onDismiss}
        className="text-xs text-red-300 hover:text-red-200 underline ml-4 shrink-0"
      >
        {dismissText}
      </button>
    </div>
  );
}
