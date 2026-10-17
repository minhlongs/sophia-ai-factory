'use client';
// i18n-namespace: stitch.pricingPage

import React from 'react';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import { cn } from '@/seed/utils/cn';
import type { BillingPeriod, TierId, PricingTier } from './pricing-types';

export interface PricingCardProps {
  tier: PricingTier;
  billing: BillingPeriod;
  selectedTier: TierId;
  onSelectTier: (id: TierId) => void;
  t: ReturnType<typeof useTranslations>;
}

export function PricingCard({ tier, billing, selectedTier, onSelectTier, t }: PricingCardProps) {
  const hasNumericPrice = tier.monthlyPrice !== null;

  const priceNumber = hasNumericPrice
    ? billing === 'monthly'
      ? tier.monthlyPrice
      : tier.yearlyPrice
    : null;

  const features = Array.from(
    { length: tier.featureCount },
    (_, i) => t(`plans.${tier.id}.features.${i}`),
  );

  const isPremium = tier.id === 'premium';
  const isEnterprise = tier.id === 'enterprise';

  const cardClasses = cn(
    'relative flex flex-col rounded-2xl p-8',
    'transition-all duration-300',
    isPremium
      ? 'z-10 lg:-translate-y-2 border-2 border-primary bg-white dark:bg-[#11131F] shadow-xl shadow-primary/10 dark:shadow-2xl dark:shadow-primary-950/60'
      : 'border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#11131F] hover:border-primary/40 dark:hover:border-white/20 hover:-translate-y-1 shadow-sm dark:shadow-none',
  );

  const badgeClasses =
    'absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-accent dark:bg-[#F59E0B] px-4 py-1 text-xs font-black uppercase tracking-wider text-white dark:text-[#090A10] shadow-md';

  return (
    <div
      className={cn(cardClasses, isPremium && 'group')}
      role="article"
      aria-label={t(`plans.${tier.id}.name`)}
    >
      {/* Popular Badge */}
      {tier.popular && (
        <div className={badgeClasses} aria-label={t('popular')}>
          ★ {t('popular')}
        </div>
      )}

      {/* Hidden radio for tier selection (E2E test hook) */}
      <input
        type="radio"
        name="tier"
        value={tier.id}
        checked={selectedTier === tier.id}
        onChange={() => onSelectTier(tier.id)}
        className="sr-only"
      />

      {/* Name & Description */}
      <div className="mb-6">
        <h3 className="mb-2 text-xl font-bold text-[#0B0F19] dark:text-white font-display">
          {t(`plans.${tier.id}.name`)}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 min-h-[36px] leading-relaxed">
          {t(`plans.${tier.id}.description`)}
        </p>
      </div>

      {/* Price */}
      <div className="mb-8 pb-6 border-b border-[#E2E8F0] dark:border-white/[0.08]">
        {priceNumber !== null ? (
          <div className="flex items-baseline gap-1 font-mono">
            <span className="text-3xl font-bold text-slate-400 dark:text-slate-400">$</span>
            <span className="text-5xl font-black text-[#0B0F19] dark:text-white tracking-tight font-mono">{priceNumber}</span>
            <span className="ml-1 text-xs text-slate-500 dark:text-slate-400 font-sans font-medium">
              {t(`plans.${tier.id}.period.${billing}`)}
            </span>
          </div>
        ) : (
          <div className="flex items-baseline">
            <span className="text-4xl font-black font-mono text-[#0B0F19] dark:text-white tracking-tight">
              {t('plans.master.price')}
            </span>
            <span className="ml-2 text-xs text-slate-500 dark:text-slate-400 font-sans font-medium">
              {t('plans.master.period')}
            </span>
          </div>
        )}
      </div>

      {/* Features */}
      <ul className="mb-8 flex flex-grow flex-col gap-3.5">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
            <Check
              className="h-4 w-4 flex-shrink-0 text-primary dark:text-primary-400 mt-0.5"
              aria-hidden="true"
            />
            <span className="leading-normal">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <div className="mt-auto">
        <Link
          href={tier.id === 'master' ? '/contact' : '/register'}
          className={cn(
            'w-full block text-center rounded-xl py-3.5 text-sm font-bold transition-all active:scale-[0.98]',
            isPremium
              ? 'bg-primary hover:bg-primary-700 dark:bg-primary dark:hover:bg-primary-500 text-white shadow-lg shadow-primary/20 dark:shadow-primary-500/25'
              : isEnterprise
              ? 'bg-primary/10 dark:bg-primary-500/15 border border-primary/25 dark:border-primary-500/30 text-primary dark:text-primary-300 hover:bg-primary/20 dark:hover:bg-primary-500/25 dark:hover:text-white'
              : 'bg-[#F8F9FC] dark:bg-white/[0.06] border border-[#E2E8F0] dark:border-white/[0.1] text-[#0B0F19] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.12] dark:hover:text-white',
          )}
        >
          {t(`plans.${tier.id}.cta`)}
        </Link>
      </div>
    </div>
  );
}
