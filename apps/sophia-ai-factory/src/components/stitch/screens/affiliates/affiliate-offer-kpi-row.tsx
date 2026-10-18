'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { TrendingUp, DollarSign, Percent } from 'lucide-react';

export interface AffiliateOfferKpiRowProps {
  commissionRate: number;
  epcValue: string;
  convRateValue: string;
}

export function AffiliateOfferKpiRow({
  commissionRate,
  epcValue,
  convRateValue,
}: AffiliateOfferKpiRowProps) {
  const t = useTranslations('stitch.affiliates.discovery.card');

  return (
    <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border dark:border-white/[0.06]">
      <div className="text-center p-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.02]">
        <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground font-medium">
          <Percent className="w-3 h-3 text-primary" />
          <span>{t('commission')}</span>
        </div>
        <div className="text-sm font-bold text-foreground dark:text-white mt-0.5">
          {commissionRate}%
        </div>
      </div>

      <div className="text-center p-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.02]">
        <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground font-medium">
          <DollarSign className="w-3 h-3 text-emerald-400" />
          <span>{t('epc')}</span>
        </div>
        <div className="text-sm font-bold text-emerald-400 mt-0.5">
          ${epcValue}
        </div>
      </div>

      <div className="text-center p-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.02]">
        <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground font-medium">
          <TrendingUp className="w-3 h-3 text-indigo-400" />
          <span>{t('convRate')}</span>
        </div>
        <div className="text-sm font-bold text-indigo-400 mt-0.5">
          {convRateValue}%
        </div>
      </div>
    </div>
  );
}
