'use client';

import React, { useState, useTransition } from 'react';
import type { CockpitExecutiveSnapshot } from '../affiliate-cockpit-types';
import { toggleAffiliateKillSwitchAction } from '../../actions/toggle-kill-switch-action';
import {
  formatCockpitCurrency,
  getAffiliateCockpitCopy,
} from './affiliate-cockpit-copy';
import { AffiliateCockpitHookList } from './AffiliateCockpitHookList';
import { AffiliateDomainBSummaryBar } from './AffiliateDomainBSummaryBar';

interface AffiliateCockpitViewProps {
  snapshot: CockpitExecutiveSnapshot;
  onToggleKillSwitch?: (active: boolean) => void;
  locale?: 'en' | 'vi';
}

export function AffiliateCockpitView({
  snapshot,
  onToggleKillSwitch,
  locale = 'vi',
}: AffiliateCockpitViewProps) {
  const { metrics, topPerformingHooks } = snapshot;
  const [active, setActive] = useState(snapshot.killSwitchActive);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    const nextState = !active;
    setActive(nextState);
    setErrorMessage(null);
    onToggleKillSwitch?.(nextState);

    startTransition(async () => {
      const result = await toggleAffiliateKillSwitchAction({
        active: nextState,
        tenantId: snapshot.tenantId,
      });
      if (!result.ok) {
        setActive(!nextState);
        setErrorMessage(result.error.message);
      }
    });
  };

  const t = getAffiliateCockpitCopy(locale);

  return (
    <div className="w-full space-y-6 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">{t.title}</h2>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isPending}
              onClick={handleToggle}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                active
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              } ${isPending ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isPending ? t.updating : active ? t.killSwitchActiveText : t.killSwitchNormalText}
            </button>
          </div>
          {errorMessage && <p className="text-xs text-destructive font-medium">{errorMessage}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border/50 bg-background/50 p-4">
          <p className="text-xs font-medium text-muted-foreground">{t.gross}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {formatCockpitCurrency(metrics.totalGrossCommissionCents)}
          </p>
        </div>
        <div className="rounded-lg border border-border/50 bg-background/50 p-4">
          <p className="text-xs font-medium text-muted-foreground">{t.holdback}</p>
          <p className="mt-1 text-2xl font-bold text-amber-500">
            {formatCockpitCurrency(metrics.totalHoldbackReserveCents)}
          </p>
        </div>
        <div className="rounded-lg border border-border/50 bg-background/50 p-4">
          <p className="text-xs font-medium text-muted-foreground">{t.netPayable}</p>
          <p className="mt-1 text-2xl font-bold text-emerald-500">
            {formatCockpitCurrency(metrics.totalNetPayableCents)}
          </p>
        </div>
        <div className="rounded-lg border border-border/50 bg-background/50 p-4">
          <p className="text-xs font-medium text-muted-foreground">{t.refundRate}</p>
          <p className={`mt-1 text-2xl font-bold ${metrics.isRefundRiskAlert ? 'text-destructive' : 'text-foreground'}`}>
            {metrics.effectiveRefundRatePercent}%
          </p>
          {metrics.isRefundRiskAlert && (
            <p className="mt-1 text-[11px] font-medium text-destructive">{t.riskWarning}</p>
          )}
        </div>
      </div>

      <AffiliateDomainBSummaryBar metrics={metrics} locale={locale} />

      <AffiliateCockpitHookList
        topHooksTitle={t.topHooksTitle}
        topPerformingHooks={topPerformingHooks}
      />
    </div>
  );
}
