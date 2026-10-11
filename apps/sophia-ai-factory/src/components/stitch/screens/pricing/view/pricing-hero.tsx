'use client';

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
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-6">
        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
        Transparent Pricing
      </div>
      <h1 className="mb-5 text-4xl sm:text-6xl font-black text-white tracking-tight font-display">
        {t('hero.title')}
      </h1>
      <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-300 leading-relaxed">
        {t('hero.subtitle')}
      </p>

      {/* Billing Toggle */}
      <div className="inline-flex items-center justify-center p-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
        {(['monthly', 'yearly'] as const).map((period) => (
          <label
            key={period}
            className={cn(
              'inline-flex cursor-pointer items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold transition-all duration-200 select-none',
              billing === period
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25'
                : 'text-slate-400 hover:text-white',
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
              <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {t('billing.savePercent')}
              </span>
            )}
          </label>
        ))}
      </div>
    </section>
  );
}
