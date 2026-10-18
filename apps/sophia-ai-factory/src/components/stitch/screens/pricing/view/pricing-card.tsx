'use client';
// i18n-namespace: stitch.pricingPage

import React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import type { BillingPeriod, TierId, PricingTier } from './pricing-types';
import {
  getCardClasses,
  getBadgeClasses,
  getPrice,
  getFeatures,
  getCtaClasses,
  renderFeatures,
} from './pricing-card-helpers';

export interface PricingCardProps {
  tier: PricingTier;
  billing: BillingPeriod;
  selectedTier: TierId;
  onSelectTier: (id: TierId) => void;
  t: ReturnType<typeof useTranslations>;
}

export function PricingCard({ tier, billing, selectedTier, onSelectTier, t }: PricingCardProps) {
  const isPremium = tier.id === 'premium';
  const isEnterprise = tier.id === 'enterprise';

  const cardClasses = getCardClasses(tier, isPremium, isEnterprise);
  const badgeClasses = getBadgeClasses();
  const { priceNumber } = getPrice(tier, billing);
  const features = getFeatures(tier, t);
  const ctaClasses = getCtaClasses(isPremium, isEnterprise);

  return (
    <div
      className={cardClasses}
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
      {renderFeatures(features)}

      {/* CTA Button */}
      <div className="mt-auto">
        <Link
          href={tier.id === 'master' ? '/contact' : '/register'}
          className={ctaClasses}
        >
          {t(`plans.${tier.id}.cta`)}
        </Link>
      </div>
    </div>
  );
}