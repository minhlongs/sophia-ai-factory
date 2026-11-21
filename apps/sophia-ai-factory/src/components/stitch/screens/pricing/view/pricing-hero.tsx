'use client';
// i18n-namespace: stitch.pricingPage

import React from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/seed/utils/cn';
import type { BillingPeriod } from './pricing-types';

interface PricingHeroProps {
  billing: BillingPeriod;
  onBillingChange: (period: BillingPeriod) => void;
  t: ReturnType<typeof useTranslations>;
}

export function PricingHero({ billing, onBillingChange, t }: PricingHeroProps) {
  return (
    <section className="mb-20 text-center max-w-4xl mx-auto">
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-[#11131F] border border-[#E2E8F0] dark:border-white/[0.08] text-primary dark:text-primary-300 text-xs font-bold uppercase tracking-wider mb-6 shadow-sm">
        <Sparkles className="w-3.5 h-3.5 text-[#D97706] dark:text-[#F59E0B]" />
        {t('pricingLabel')}
      </div>
      <h1 className="mb-5 text-4xl sm:text-6xl font-black text-[#0B0F19] dark:text-white tracking-tight font-display">
        {t('hero.title')}
      </h1>
      <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
        {t('hero.subtitle')}
      </p>

      {/* Billing Toggle */}
      <div
        role="radiogroup"
        aria-label={t('pricingLabel')}
        className="inline-flex items-center justify-center p-1.5 rounded-full bg-white dark:bg-[#11131F] border border-[#E2E8F0] dark:border-white/[0.08] shadow-sm"
      >
        {(['monthly', 'yearly'] as const).map((period) => (
          <label
            key={period}
            className={cn(
              'inline-flex cursor-pointer items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold transition-all duration-200 select-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-white dark:focus-within:ring-offset-[#11131F]',
              billing === period
                ? 'bg-primary dark:bg-primary-600 text-white shadow-md shadow-primary/20 dark:shadow-primary-500/25'
                : 'text-slate-600 dark:text-slate-400 hover:text-[#0B0F19] dark:hover:text-white',
            )}
          >
            <input
              type="radio"
              name="billing"
              value={period}
              checked={billing === period}
              onChange={() => onBillingChange(period)}
              className="sr-only"
            />
            <span>{t(`billing.${period}`)}</span>
            {period === 'yearly' && (
              <span className="text-[11px] font-extrabold font-mono px-2 py-0.5 rounded-full bg-amber-500/15 dark:bg-amber-400/20 text-amber-900 dark:text-amber-300 border border-amber-600/30 dark:border-amber-400/30">
                {t('billing.savePercent')}
              </span>
            )}
          </label>
        ))}
      </div>
    </section>
  );
}
