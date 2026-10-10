/**
 * Billing Period Toggle Component
 *
 * Layer: forest/components/pricing/stitch
 */

'use client';

import React from 'react';
import type { BillingPeriod } from './types';

interface BillingToggleProps {
  billingPeriod: BillingPeriod;
  onPeriodChange: (period: BillingPeriod) => void;
  monthlyLabel: string;
  annualLabel: string;
  savePercentLabel: string;
}

export function BillingToggle({
  billingPeriod,
  onPeriodChange,
  monthlyLabel,
  annualLabel,
  savePercentLabel,
}: BillingToggleProps): React.JSX.Element {
  return (
    <div className="mt-8 flex justify-center">
      <div className="inline-flex items-center rounded-full border border-[#484750] bg-[#191920] p-1">
        <button
          type="button"
          role="switch"
          aria-checked={billingPeriod === 'monthly'}
          onClick={() => onPeriodChange('monthly')}
          className={`rounded-full px-6 py-2.5 text-sm font-semibold transition-all duration-200 ${
            billingPeriod === 'monthly' ? 'bg-primary text-white' : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          {monthlyLabel}
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={billingPeriod === 'annual'}
          onClick={() => onPeriodChange('annual')}
          className={`relative rounded-full px-6 py-2.5 text-sm font-semibold transition-all duration-200 ${
            billingPeriod === 'annual' ? 'bg-primary text-white' : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          {annualLabel}
          <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-400">
            {savePercentLabel}
          </span>
        </button>
      </div>
    </div>
  );
}
