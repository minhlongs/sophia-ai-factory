'use client';

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
    'relative flex flex-col rounded-2xl p-8 backdrop-blur-xl',
    'transition-all duration-300',
    isPremium
      ? 'z-10 lg:-translate-y-2 border-2 border-indigo-500/80 bg-gradient-to-b from-[#181B2E] to-[#111320] shadow-2xl shadow-indigo-950/60'
      : 'border border-white/[0.08] bg-[#11131E]/80 hover:border-white/20 hover:-translate-y-1',
  );

  const badgeClasses =
    'absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-1 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-indigo-500/40 border border-white/20';

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
        <h3 className="mb-2 text-xl font-bold text-white">
          {t(`plans.${tier.id}.name`)}
        </h3>
        <p className="text-xs text-slate-400 min-h-[36px] leading-relaxed">
          {t(`plans.${tier.id}.description`)}
        </p>
      </div>

      {/* Price */}
      <div className="mb-8 pb-6 border-b border-white/[0.08]">
        {priceNumber !== null ? (
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-slate-400">$</span>
            <span className="text-5xl font-black text-white tracking-tight">{priceNumber}</span>
            <span className="ml-1 text-xs text-slate-400 font-medium">
              {t(`plans.${tier.id}.period`)}
            </span>
          </div>
        ) : (
          <div className="flex items-baseline">
            <span className="text-4xl font-black text-white tracking-tight">
              {t('plans.master.price')}
            </span>
          </div>
        )}
      </div>

      {/* Features */}
      <ul className="mb-8 flex flex-grow flex-col gap-3.5">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-3 text-xs text-slate-300">
            <Check
              className="h-4 w-4 flex-shrink-0 text-indigo-400 mt-0.5"
              aria-hidden="true"
            />
            <span className="leading-normal">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <div className="mt-auto">
        <Link
          href={`/register?tier=${tier.id}`}
          className={cn(
            'w-full block text-center rounded-xl py-3.5 text-sm font-bold transition-all active:scale-[0.98]',
            isPremium
              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-500 hover:to-violet-500 shadow-xl shadow-indigo-500/30 border border-indigo-400/30'
              : isEnterprise
              ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 hover:text-white'
              : 'bg-white/[0.06] border border-white/[0.1] text-slate-200 hover:bg-white/[0.12] hover:text-white',
          )}
        >
          {t(`plans.${tier.id}.cta`)}
        </Link>
      </div>
    </div>
  );
}
