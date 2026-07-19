/**
 * PricingToggle — Annual/Monthly billing toggle with context provider.
 *
 * Provides PricingContext so child components (StitchPricingPage) can consume
 * the billing period through the useBillingPeriod() hook.
 * Falls back to internal state when used outside the provider (standalone-safe).
 *
 * @module components/billing/PricingToggle
 */

'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';
import { cn } from '@/seed/utils/cn';

export type BillingPeriod = 'monthly' | 'yearly';

const PricingContext = createContext<{
  billing: BillingPeriod;
  setBilling: (period: BillingPeriod) => void;
} | null>(null);

/**
 * Hook consuming billing period from PricingContext.
 * Falls back to internal component state when used outside the provider,
 * so it works both in standalone and wrapped usage.
 */
export function useBillingPeriod(): {
  billing: BillingPeriod;
  setBilling: (period: BillingPeriod) => void;
} {
  const ctx = useContext(PricingContext);
  const [internal, setInternal] = useState<BillingPeriod>('monthly');
  if (ctx) return { billing: ctx.billing, setBilling: ctx.setBilling };
  return { billing: internal, setBilling: setInternal };
}

/**
 * Context-only provider for billing period (renders no UI).
 * Wrap around StitchPricingPage to share billing state.
 */
export function PricingProvider({ children }: { children: ReactNode }) {
  const [billing, setBilling] = useState<BillingPeriod>('monthly');
  return (
    <PricingContext.Provider value={{ billing, setBilling }}>
      {children}
    </PricingContext.Provider>
  );
}

/**
 * Annual/Monthly pricing toggle with savings badge.
 * Wraps children with PricingContext so child components can consume billing period.
 */
export function PricingToggle({ children }: { children: ReactNode }) {
  const [billing, setBilling] = useState<BillingPeriod>('monthly');

  return (
    <PricingContext.Provider value={{ billing, setBilling }}>
      <div className="flex items-center justify-center gap-4 mb-8">
        <div
          className="inline-flex items-center rounded-full border border-zinc-800 bg-[#18181B] p-1"
          role="radiogroup"
          aria-label="Billing period"
        >
          {(['monthly', 'yearly'] as const).map((period) => (
            <button
              key={period}
              type="button"
              role="radio"
              aria-checked={billing === period}
              onClick={() => setBilling(period)}
              className={cn(
                'rounded-full px-6 py-2 text-sm font-semibold transition-all duration-300',
                billing === period
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              {period === 'monthly' ? 'Monthly' : 'Annual'}
              {period === 'yearly' && (
                <span className="ml-1.5 rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-bold text-amber-400">
                  Save {UNIFIED_TIERS.PREMIUM.yearlySavingsPercent}%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      {children}
    </PricingContext.Provider>
  );
}
