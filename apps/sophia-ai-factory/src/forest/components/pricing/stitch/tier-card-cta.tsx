/**
 * Pricing Tier Card CTA & Feature List Subcomponents
 *
 * Layer: forest/components/pricing/stitch
 */

'use client';

import React from 'react';
import type { CardConfig } from './types';

export interface TierCardLabels {
  popular: string;
  getStarted: string;
  contactSales: string;
  processing: string;
  perMonth: string;
  perYear: string;
  masterOneTime: string;
  billingMonthly: string;
  billingYearly: string;
}

export function TierCardFeatureList({ features }: { features: string[] }) {
  return (
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
  );
}

export function TierCardCta({
  config,
  isMaster,
  isAnnual,
  isLoading,
  labels,
  onSelect,
}: {
  config: CardConfig;
  isMaster: boolean;
  isAnnual: boolean;
  isLoading: boolean;
  labels: TierCardLabels;
  onSelect: (tierKey: string) => void;
}) {
  return (
    <>
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
    </>
  );
}
