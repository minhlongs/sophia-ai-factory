'use client';

/**
 * Affiliate Portal KPI Grid Component
 *
 * Displays financial metrics: Available for Payout (USD/VND), Pending 14-day hold,
 * Total Settled, and Traffic / Conversions.
 *
 * Layer: components/affiliates/portal
 * @module components/affiliates/portal/affiliate-portal-kpi-grid
 */

import React from 'react';
import type { PartnerLedgerKpiData } from '@/forest/actions/affiliate-payout-actions-schema';

interface AffiliatePortalKpiGridProps {
  kpi: PartnerLedgerKpiData;
  onRequestPayout?: () => void;
}

export function AffiliatePortalKpiGrid({
  kpi,
  onRequestPayout,
}: AffiliatePortalKpiGridProps) {
  const isEligible = kpi.availablePayoutCents >= 5000;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* 1. Available for Payout */}
      <div className="relative overflow-hidden rounded-xl border border-amber-500/20 bg-card p-5 shadow-sm transition hover:border-amber-500/40">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Available for Payout
          </span>
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            Payable
          </span>
        </div>
        <div className="mt-3">
          <div className="font-mono text-2xl font-bold tracking-tight text-foreground">
            ${(kpi.availablePayoutCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            ≈ {kpi.availablePayoutVnd.toLocaleString('vi-VN')} ₫ (VND)
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Min $50.00</span>
          {onRequestPayout && (
            <button
              type="button"
              onClick={onRequestPayout}
              disabled={!isEligible}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition ${
                isEligible
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              Request Payout
            </button>
          )}
        </div>
      </div>

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
    </div>
  );
}
