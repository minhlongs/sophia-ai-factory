import React from 'react';
import { ShieldCheck, Clock, DollarSign, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Approval } from './types';

interface ApprovalExecutiveHeaderProps {
  /**
   * `undefined` means the queue could not be read, so every number below is
   * unknown. An empty array is a real answer from the server: nothing is
   * waiting. A failed load must not print as zero pending approvals.
   */
  approvals?: Approval[];
}

export function ApprovalExecutiveHeader({ approvals }: ApprovalExecutiveHeaderProps) {
  const t = useTranslations('approvals');

  if (approvals === undefined) {
    return (
      <div
        data-testid="opc-ceo-approval-summary"
        data-status="error"
        className="mb-6 rounded-xl border border-border bg-card dark:bg-[#11131F] p-4 sm:p-5 shadow-sm"
      >
        <p className="text-sm text-muted-foreground">{t('header.unavailableNote')}</p>
      </div>
    );
  }

  const pendingCount = approvals.length;
  // An approval may have no cost estimate yet. Summing those as zero would
  // report a total the server never claimed, so unknown costs are counted
  // separately and reported as such.
  const withKnownCost = approvals.filter((a) => typeof a.estimatedCostCents === 'number');
  const totalEstCostCents = withKnownCost.reduce(
    (sum, a) => sum + (a.estimatedCostCents as number),
    0,
  );
  const hasUnknownCost = withKnownCost.length < approvals.length;
  const blockedCount = approvals.filter((a) => a.complianceStatus === 'blocked').length;

  return (
    <div
      data-testid="opc-ceo-approval-summary"
      className="mb-6 rounded-xl border border-border bg-card dark:bg-[#11131F] p-4 sm:p-5 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            {t('header.eyebrow')}
          </span>
          <h2 className="text-base font-bold text-foreground mt-0.5">{t('header.title')}</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <ShieldCheck className="h-3.5 w-3.5" />
          {t('header.controlNote')}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
        <div className="rounded-lg bg-background/60 p-3 border border-border/50">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3 text-amber-500" /> {t('header.pending')}
          </span>
          <p className="mt-1 text-xl font-bold font-mono text-foreground">{pendingCount}</p>
        </div>

        <div className="rounded-lg bg-background/60 p-3 border border-border/50">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-indigo-500" /> {t('header.budget')}
          </span>
          <p className="mt-1 text-xl font-bold font-mono text-foreground">
            ${(totalEstCostCents / 100).toFixed(2)}
          </p>
          {hasUnknownCost && (
            <p
              data-testid="approval-budget-unknown-note"
              className="mt-1 text-[11px] leading-snug text-muted-foreground"
            >
              {t('header.costPartiallyUnknown')}
            </p>
          )}
        </div>

        <div className="rounded-lg bg-background/60 p-3 border border-border/50">
          <span className="text-[11px] font-medium text-muted-foreground">{t('header.blocked')}</span>
          <p className="mt-1 text-xl font-bold font-mono text-foreground">{blockedCount}</p>
        </div>

        <div className="rounded-lg bg-background/60 p-3 border border-border/50">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" /> {t('header.reapproval')}
          </span>
          <p className="mt-1 text-xs text-muted-foreground">{t('header.reapprovalNote')}</p>
        </div>
      </div>
    </div>
  );
}
