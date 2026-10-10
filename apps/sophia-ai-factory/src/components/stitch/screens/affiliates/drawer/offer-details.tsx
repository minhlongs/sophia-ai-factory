'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Percent, DollarSign, TrendingUp } from 'lucide-react';
import type { AffiliateOffer } from '@/seed/types/affiliate';

interface OfferDetailsProps {
  offer: AffiliateOffer;
}

export function OfferDetails({ offer }: OfferDetailsProps) {
  const t = useTranslations('stitch.affiliates.drawer');

  return (
    <>
      {/* Offer Title & Summary */}
      <div className="mt-4">
        <span className="text-xs font-bold uppercase tracking-wider text-primary">
          {t('title')}
        </span>
        <h3
          id="offer-drawer-title"
          className="text-xl font-bold text-foreground dark:text-white mt-1"
        >
          {offer.programName}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {offer.commissionTerms}
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-3 mt-5">
        <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-border dark:border-white/[0.06]">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <Percent className="w-3.5 h-3.5 text-primary" />
            <span>Commission</span>
          </div>
          <div className="text-base font-bold text-foreground dark:text-white mt-1">
            {offer.commissionRatePct}%
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-border dark:border-white/[0.06]">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>EPC</span>
          </div>
          <div className="text-base font-bold text-emerald-400 mt-1">
            ${offer.epc.toFixed(2)}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-border dark:border-white/[0.06]">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
            <span>Conv. Rate</span>
          </div>
          <div className="text-base font-bold text-indigo-400 mt-1">
            {offer.conversionRatePct}%
          </div>
        </div>
      </div>
    </>
  );
}
