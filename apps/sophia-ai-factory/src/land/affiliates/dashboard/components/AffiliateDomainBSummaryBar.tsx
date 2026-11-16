'use client';

import React from 'react';
import type { CockpitSummaryMetrics } from '../affiliate-cockpit-types';
import { formatCockpitCurrency, getAffiliateCockpitCopy } from './affiliate-cockpit-copy';

interface AffiliateDomainBSummaryBarProps {
  metrics: CockpitSummaryMetrics;
  locale: 'en' | 'vi';
}

export function AffiliateDomainBSummaryBar({ metrics, locale }: AffiliateDomainBSummaryBarProps) {
  const cryptoCents = metrics.nicheBreakdown?.cryptoCexCommissionCents ?? 0;
  const saasCents = metrics.nicheBreakdown?.globalSaasCommissionCents ?? 0;
  const currencyEntries = Object.values(metrics.domainBSummary?.byCurrency ?? {});
  const t = getAffiliateCockpitCopy(locale);

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

      {metrics.hasData === false && currencyEntries.length === 0 && cryptoCents === 0 && saasCents === 0 ? (
        <div
          data-testid="domain-b-empty-state"
          className="rounded-md border border-dashed border-border/60 bg-background/50 px-3 py-2 text-xs text-muted-foreground"
        >
          {t.emptyLedgerText}
        </div>
      ) : null}

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

      {currencyEntries.length > 0 && (
        <div className="space-y-1.5 pt-1" data-testid="domain-b-currency-breakdown">
          <p className="text-[11px] font-medium text-muted-foreground">{t.currencyGroupTitle}</p>
          <div className="flex flex-wrap gap-2">
            {currencyEntries.map((curr) => (
              <div
                key={curr.currency}
                className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/80 px-2.5 py-1 text-xs font-mono"
              >
                <span className="font-bold text-foreground">{curr.currency}:</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  {formatCockpitCurrency(curr.effectiveCommissionCents, curr.currency)}
                </span>
                {curr.pendingCents > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    (Pending: {formatCockpitCurrency(curr.pendingCents, curr.currency)})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
