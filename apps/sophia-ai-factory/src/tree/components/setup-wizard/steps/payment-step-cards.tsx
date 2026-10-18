"use client";

import React from 'react';
import { useTranslations } from 'next-intl';
import { CreditCard, Zap } from 'lucide-react';
import { UNIFIED_TIERS } from '@/seed/config/tiers';
import type { Tier } from '@/seed/types';

export type TierType = Tier;

export interface TierDetailInfo {
  name: string;
  mcuMonthly: number;
  price: number;
  billingType: 'monthly' | 'lifetime';
}

function getTierDetails(tier: TierType): TierDetailInfo {
  const canonical = UNIFIED_TIERS[tier];
  return {
    name: canonical.name,
    mcuMonthly: canonical.mcuMonthly,
    price: canonical.price,
    billingType: canonical.billingType,
  };
}

export const TIER_DETAILS: Record<TierType, TierDetailInfo> = {
  BASIC: getTierDetails('BASIC'),
  PREMIUM: getTierDetails('PREMIUM'),
  ENTERPRISE: getTierDetails('ENTERPRISE'),
  MASTER: getTierDetails('MASTER'),
};

interface PaymentCardsGridProps {
  details: TierDetailInfo;
  subscriptionStatus: string;
  renewalDate?: string;
  mcuBalance?: number;
}

export function PaymentCardsGrid({
  details,
  subscriptionStatus,
  renewalDate,
  mcuBalance,
}: PaymentCardsGridProps) {
  const t = useTranslations('setupWizard.payments');
  const priceAmount = `$${details.price.toLocaleString('en-US')}`;
  const price = t(details.billingType === 'lifetime' ? 'oneTimePrice' : 'monthlyPrice', {
    amount: priceAmount,
  });
  const renewal = details.billingType === 'lifetime'
    ? t('noRenewal')
    : renewalDate ?? t('renewalDatePending');

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Tier Card */}
      <div className="p-5 rounded-xl border border-[#4338CA]/25 dark:border-[#6366F1]/25 bg-[#F8F9FC] dark:bg-[#090A10]/60 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-[#4338CA]/10 dark:bg-[#6366F1]/15 border border-[#4338CA]/20 dark:border-[#6366F1]/25 flex items-center justify-center text-[#4338CA] dark:text-[#6366F1]">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-[#4338CA] dark:text-[#6366F1] uppercase tracking-wider">
                {t('activeTier')}
              </span>
              <h3 className="text-lg font-bold text-foreground">
                {details.name}
              </h3>
            </div>
          </div>
          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
            {subscriptionStatus}
          </span>
        </div>

        <div className="pt-2 border-t border-border dark:border-white/[0.08] space-y-2 text-xs">
          <div className="flex justify-between items-center py-1">
            <span className="text-muted-foreground">{t('planPrice')}:</span>
            <span className="font-mono font-semibold text-foreground">{price}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-muted-foreground">{t('billingCycle')}:</span>
            <span className="font-medium text-foreground">
              {t(details.billingType === 'lifetime' ? 'oneTimeBilling' : 'monthlyBilling')}
            </span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-muted-foreground">{t('nextPayment')}:</span>
            <span className="font-mono font-medium text-foreground">{renewal}</span>
          </div>
        </div>
      </div>

      {/* MCU Quota Card */}
      <div className="p-5 rounded-xl border border-border dark:border-white/[0.08] bg-[#F8F9FC] dark:bg-[#090A10]/60 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-lg bg-[#D97706]/10 dark:bg-[#F59E0B]/15 border border-[#D97706]/20 dark:border-[#F59E0B]/25 flex items-center justify-center text-[#D97706] dark:text-[#F59E0B]">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Compute Allowance / Hạn mức MCU
            </span>
            <h3 className="font-mono text-lg font-bold text-foreground">
              {mcuBalance !== undefined
                ? `${mcuBalance.toLocaleString('en-US')} MCU`
                : `${details.mcuMonthly.toLocaleString('en-US')} MCU`}
            </h3>
          </div>
        </div>

        <div className="pt-2 border-t border-border dark:border-white/[0.08] space-y-2 text-xs">
          <div className="flex justify-between items-center py-1">
            <span className="text-muted-foreground">{t('estimatedProduction')}:</span>
            <span className="font-semibold text-[#4338CA] dark:text-[#6366F1]">{t('variesByWorkflow')}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-muted-foreground">{t('planBaseQuota')}:</span>
            <span className="font-mono font-medium text-foreground">
              {t('monthlyMcuQuota', { mcu: details.mcuMonthly.toLocaleString('en-US') })}
            </span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-muted-foreground">{t('providerCosts')}:</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{t('directProviderBilling')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
