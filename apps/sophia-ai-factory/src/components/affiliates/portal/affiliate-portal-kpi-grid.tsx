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
import {
  AffiliateSecondaryKpiCards,
  type AffiliateSecondaryKpiCardsProps,
} from './affiliate-portal-kpi-cards';

export { AffiliateSecondaryKpiCards, type AffiliateSecondaryKpiCardsProps };

export interface AffiliatePortalKpiGridProps {
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

      <AffiliateSecondaryKpiCards kpi={kpi} />
    </div>
  );
}
