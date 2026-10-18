/**
 * Pricing Tier Card Component
 *
 * Layer: forest/components/pricing/stitch
 */

'use client';

import React from 'react';
import { formatPrice } from '../pricing-card';
import type { CardConfig } from './types';
import {
  TierCardCta,
  TierCardFeatureList,
  type TierCardLabels,
} from './tier-card-cta';

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
  labels: TierCardLabels;
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

      <TierCardFeatureList features={features} />

      <TierCardCta
        config={config}
        isMaster={isMaster}
        isAnnual={isAnnual}
        isLoading={isLoading}
        labels={labels}
        onSelect={onSelect}
      />
    </div>
  );
}
