'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { Card, Badge } from '@/components/stitch';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import type { Tier } from '@/seed/types';
import { type BillingPeriod, TIER_ORDER } from './types';

interface PlanSelectorProps {
  selectedTier: Tier;
  onSelectTier: (tier: Tier) => void;
  billingPeriod: BillingPeriod;
  onChangeBillingPeriod: (period: BillingPeriod) => void;
  isMaster: boolean;
}

export function PlanSelector({
  selectedTier,
  onSelectTier,
  billingPeriod,
  onChangeBillingPeriod,
  isMaster,
}: PlanSelectorProps) {
  return (
    <Card padding="lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground">1. Choose Your Plan</h2>
        {!isMaster && (
          <div className="flex items-center p-0.5 rounded-lg bg-muted text-xs font-medium">
            <button
              type="button"
              onClick={() => onChangeBillingPeriod('monthly')}
              className={`px-3 py-1 rounded-md transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => onChangeBillingPeriod('yearly')}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1 ${
                billingPeriod === 'yearly'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Yearly</span>
              <span className="text-[10px] text-emerald-400 font-bold">-17%</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TIER_ORDER.map((tierKey) => {
          const cfg = UNIFIED_TIERS[tierKey];
          const isSelected = selectedTier === tierKey;
          const price =
            tierKey === 'MASTER'
              ? cfg.price
              : billingPeriod === 'yearly'
                ? cfg.yearlyPrice
                : cfg.price;
          const periodSuffix =
            tierKey === 'MASTER' ? 'lifetime' : billingPeriod === 'yearly' ? '/yr' : '/mo';

          return (
            <div
              key={tierKey}
              onClick={() => onSelectTier(tierKey)}
              className={`
                p-4 rounded-xl cursor-pointer border-2 transition-all flex flex-col justify-between
                ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-border bg-card/50 hover:bg-muted/50'
                }
              `}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-foreground text-sm">{cfg.name}</span>
                  {tierKey === 'PREMIUM' && (
                    <Badge
                      variant="soft"
                      color="primary"
                      className="text-[10px] bg-primary/20 text-primary border-0"
                    >
                      Popular
                    </Badge>
                  )}
                  {tierKey === 'MASTER' && (
                    <Badge
                      variant="soft"
                      color="warning"
                      className="text-[10px] bg-amber-500/20 text-amber-300 border-0"
                    >
                      Lifetime
                    </Badge>
                  )}
                </div>
                <p className="text-2xl font-black text-foreground">
                  ${price}
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    {periodSuffix}
                  </span>
                </p>
              </div>

              <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground flex items-center justify-between">
                <span>{cfg.mcuMonthly.toLocaleString()} MCU / mo</span>
                {isSelected && <Check className="w-4 h-4 text-primary" />}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
