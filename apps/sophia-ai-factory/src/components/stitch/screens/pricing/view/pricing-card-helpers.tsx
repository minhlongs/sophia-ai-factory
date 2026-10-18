'use client';

/**
 * Helpers for PricingCard component.
 * Layer: components/stitch/screens/pricing/view
 * @module components/stitch/screens/pricing/view/pricing-card-helpers
 */

import { Check } from 'lucide-react';
import { cn } from '@/seed/utils/cn';
import type { BillingPeriod, TierId, PricingTier } from './pricing-types';
import type { useTranslations } from 'next-intl';

type UseTranslationsReturnType = ReturnType<typeof useTranslations>;

export function getCardClasses(tier: PricingTier, isPremium: boolean, isEnterprise: boolean) {
  return cn(
    'relative flex flex-col rounded-2xl p-8',
    'transition-all duration-300',
    isPremium
      ? 'z-10 lg:-translate-y-2 border-2 border-primary bg-white dark:bg-[#11131F] shadow-xl shadow-primary/10 dark:shadow-2xl dark:shadow-primary-950/60'
      : 'border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#11131F] hover:border-primary/40 dark:hover:border-white/20 hover:-translate-y-1 shadow-sm dark:shadow-none',
  );
}

export function getBadgeClasses() {
  return 'absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-accent dark:bg-[#F59E0B] px-4 py-1 text-xs font-black uppercase tracking-wider text-white dark:text-[#090A10] shadow-md';
}

export function getPrice(tier: PricingTier, billing: BillingPeriod) {
  const hasNumericPrice = tier.monthlyPrice !== null;
  if (!hasNumericPrice) return { priceNumber: null };

  return {
    priceNumber: billing === 'monthly' ? tier.monthlyPrice : tier.yearlyPrice,
  };
}

export function getFeatures(tier: PricingTier, t: UseTranslationsReturnType) {
  return Array.from(
    { length: tier.featureCount },
    (_, i) => t(`plans.${tier.id}.features.${i}`),
  );
}

export function getCtaClasses(isPremium: boolean, isEnterprise: boolean) {
  return cn(
    'w-full block text-center rounded-xl py-3.5 text-sm font-bold transition-all active:scale-[0.98]',
    isPremium
      ? 'bg-primary hover:bg-primary-700 dark:bg-primary dark:hover:bg-primary-500 text-white shadow-lg shadow-primary/20 dark:shadow-primary-500/25'
      : isEnterprise
        ? 'bg-primary/10 dark:bg-primary-500/15 border border-primary/25 dark:border-primary-500/30 text-primary dark:text-primary-300 hover:bg-primary/20 dark:hover:bg-primary-500/25 dark:hover:text-white'
        : 'bg-[#F8F9FC] dark:bg-white/[0.06] border border-[#E2E8F0] dark:border-white/[0.1] text-[#0B0F19] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.12] dark:hover:text-white',
  );
}

export function renderFeatures(features: string[]) {
  return (
    <ul className="mb-8 flex flex-grow flex-col gap-3.5">
      {features.map((feature, idx) => (
        <li key={idx} className="flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
          <Check className="h-4 w-4 flex-shrink-0 text-primary dark:text-primary-400 mt-0.5" aria-hidden="true" />
          <span className="leading-normal">{feature}</span>
        </li>
      ))}
    </ul>
  );
}