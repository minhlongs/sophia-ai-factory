'use client';

import React from 'react';
import type { CockpitSummaryMetrics } from '../affiliate-cockpit-types';
import { formatCockpitCurrency } from './affiliate-cockpit-copy';

interface AffiliateDomainBSummaryBarProps {
  metrics: CockpitSummaryMetrics;
  locale: 'en' | 'vi';
}

export function AffiliateDomainBSummaryBar({ metrics, locale }: AffiliateDomainBSummaryBarProps) {
  const cryptoCents = metrics.nicheBreakdown?.cryptoCexCommissionCents ?? Math.round(metrics.totalNetPayableCents * 0.52);
  const saasCents = metrics.nicheBreakdown?.globalSaasCommissionCents ?? (metrics.totalNetPayableCents - cryptoCents);

  return (
    <div
      data-testid="domain-b-reconciliation-bar"
      className="rounded-lg border border-indigo-500/20 bg-indigo-500/[0.04] p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
            DOMAIN B • 0% PLATFORM FEE
          </span>
          <span className="text-muted-foreground">
            {locale === 'vi'
              ? '100% Hoa hồng thuộc về Chủ Doanh Nghiệp (BYOK)'
              : '100% Workspace-Owned External Affiliate Revenue'}
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span>Pending → Approved → Reversed →</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">Paid Receipt</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/70 px-3 py-2">
          <span className="text-xs font-medium text-foreground">
            ⚡ Crypto / CEX Affiliate (Non-Custodial)
          </span>
          <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
            {formatCockpitCurrency(cryptoCents)}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/70 px-3 py-2">
          <span className="text-xs font-medium text-foreground">
            💻 Global SaaS Affiliate (Recurring MRR)
          </span>
          <span className="font-mono text-sm font-bold text-amber-600 dark:text-amber-400">
            {formatCockpitCurrency(saasCents)}
          </span>
        </div>
      </div>
    </div>
  );
}
