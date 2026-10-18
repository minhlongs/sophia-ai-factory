'use client';

import React from 'react';
import type { PartnerLedgerKpiData } from '@/forest/actions/affiliate-payout-actions-schema';

export interface AffiliateSecondaryKpiCardsProps {
  kpi: PartnerLedgerKpiData;
}

export function AffiliateSecondaryKpiCards({ kpi }: AffiliateSecondaryKpiCardsProps) {
  return (
    <>
      {/* 2. Pending 14-Day Rolling Hold */}
      <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Rolling Hold (14d)
          </span>
          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
            In Escrow
          </span>
        </div>
        <div className="mt-3">
          <div className="font-mono text-2xl font-bold tracking-tight text-foreground">
            ${(kpi.pendingHoldCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Next unlock in ~{kpi.nextHoldReleaseDays} days
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
          Anti-chargeback protection window
        </div>
      </div>

      {/* 3. Total Settled Earnings */}
      <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Total Settled
          </span>
          <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
            Lifetime
          </span>
        </div>
        <div className="mt-3">
          <div className="font-mono text-2xl font-bold tracking-tight text-foreground">
            ${(kpi.totalSettledCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Default Rail: {kpi.defaultRail}
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground truncate">
          {kpi.maskedDestination}
        </div>
      </div>

      {/* 4. Traffic & Performance */}
      <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Conversions
          </span>
          <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
            {kpi.conversionRatePct.toFixed(1)}% CVR
          </span>
        </div>
        <div className="mt-3">
          <div className="font-mono text-2xl font-bold tracking-tight text-foreground">
            {kpi.totalReferrals}{' '}
            <span className="text-sm font-normal text-muted-foreground">
              / {kpi.totalClicks.toLocaleString()} clicks
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            RevShare Rate: {kpi.commissionRatePct}%
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
          Code: <span className="font-mono font-medium text-foreground">{kpi.partnerCode}</span>
        </div>
      </div>
    </>
  );
}
