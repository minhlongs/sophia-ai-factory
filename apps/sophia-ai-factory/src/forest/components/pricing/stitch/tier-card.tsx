/**
 * Pricing Tier Card Component
 *
 * Layer: forest/components/pricing/stitch
 */

'use client';

import React from 'react';
import { formatPrice } from '../pricing-card';
import type { CardConfig } from './types';

interface TierCardProps {
  config: CardConfig;
  tierName: string;
  description: string;
  features: string[];
  priceCents: number;
  discountedCents?: number;
  isAnnual: boolean;
  isLoading: boolean;
  locale: string;
  labels: {
    popular: string;
    getStarted: string;
    contactSales: string;
    processing: string;
    perMonth: string;
    perYear: string;
    masterOneTime: string;
    billingMonthly: string;
    billingYearly: string;
  };
  onSelect: (tierKey: string) => void;
}

export function TierCard({
  config,
  tierName,
  description,
  features,
  priceCents,
  discountedCents,
  isAnnual,
  isLoading,
  locale,
  labels,
  onSelect,
}: TierCardProps) {
  const isMaster = config.tier === 'MASTER';

  return (
    <div
      className={`relative flex flex-col p-8 transition-all duration-300 ${
        config.highlighted
          ? 'border-2 border-primary bg-[#191920] shadow-xl shadow-primary/20 scale-[1.05] z-10 rounded-lg'
          : 'border border-[#484750] bg-[#191920] hover:border-primary/50 rounded-lg'
      }`}
    >
      {config.tier === 'PREMIUM' && (
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
          {labels.popular}
        </span>
      )}

      <h3 className={`text-lg font-semibold ${config.tier === 'PREMIUM' ? 'text-[#e7e4f0]' : 'text-[#A1A1AA]'}`}>
        {tierName}
      </h3>

      <p className="mt-1 text-sm text-[#71717A]">{description}</p>

      <div className="mt-4 mb-8">
        <div className="flex items-baseline gap-2 flex-wrap">
          {discountedCents !== undefined ? (
            <>
              <span className="text-4xl font-bold text-emerald-400">
                {formatPrice(discountedCents, locale)}
              </span>
              <span className="text-2xl line-through text-[#52525B]">
                {formatPrice(priceCents, locale)}
              </span>
            </>
          ) : (
            <span className="text-4xl font-bold text-[#e7e4f0]">
              {formatPrice(priceCents, locale)}
            </span>
          )}
          <span className="text-sm text-[#71717A]">
            {isMaster ? labels.masterOneTime : isAnnual ? labels.perYear : labels.perMonth}
          </span>
        </div>
      </div>

      <ul className="mb-10 flex-1 space-y-4">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-[#A1A1AA]">
            <svg
              className="mt-0.5 h-[18px] w-[18px] shrink-0 text-primary"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      {config.ctaVariant === 'primary' ? (
        <button
          onClick={() => onSelect(config.tier)}
          disabled={isLoading}
          className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-bold text-white transition-all duration-200 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? labels.processing : labels.getStarted}
        </button>
      ) : config.ctaVariant === 'outline' ? (
        <button
          onClick={() => onSelect(config.tier)}
          disabled={isLoading}
          className="w-full rounded-lg border border-primary px-6 py-3 text-sm font-bold text-primary transition-all duration-200 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? labels.processing : labels.getStarted}
        </button>
      ) : (
        <button
          onClick={() => onSelect(config.tier)}
          disabled={isLoading}
          className="w-full rounded-lg border border-[#484750] px-6 py-3 text-sm font-bold text-[#A1A1AA] transition-all duration-200 hover:border-primary/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? labels.processing : isMaster ? labels.contactSales : labels.getStarted}
        </button>
      )}

      {!isMaster && (
        <p className="mt-3 text-center text-xs text-[#52525B]">
          {isAnnual ? labels.billingYearly : labels.billingMonthly}
        </p>
      )}
    </div>
  );
}
