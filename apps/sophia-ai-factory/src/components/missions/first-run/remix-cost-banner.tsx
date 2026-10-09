/**
 * First-Run Wizard Blueprint Remix & Pre-Flight Cost Banner
 * Layer: components/missions (UI Presentation)
 *
 * @module components/missions/first-run/remix-cost-banner
 */

// i18n-namespace: dashboard.missions.wizard

import React from 'react';
import { Award, Coins } from 'lucide-react';
import { Link } from '@/navigation';
import type { MarketplaceBlueprintItem } from '@/seed/types/creator-marketplace';

export interface RemixCostBannerProps {
  t: (key: string, values?: Record<string, string | number>) => string;
  initialBlueprint: MarketplaceBlueprintItem;
  blueprintCost: {
    estimatedUsd: number;
    totalMCU: number;
    totalCostCents: number;
  };
  initialMcuBalance: number;
  isAllowed: boolean;
  missingMcu: number;
}

export function RemixCostBanner({
  t,
  initialBlueprint,
  blueprintCost,
  initialMcuBalance,
  isAllowed,
  missingMcu,
}: RemixCostBannerProps) {
  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-5 space-y-4 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-0.5 text-xs font-semibold text-indigo-400">
            {t('remixPill')}
          </span>
          <span className="text-xs text-muted-foreground capitalize">
            {initialBlueprint.targetPlatform.replace('_', ' ')}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
          <Award className="h-4 w-4" />
          <span>{(initialBlueprint.conversionRate * 100).toFixed(1)}% CVR</span>
        </div>
      </div>

      <div>
        <h3 className="text-base font-bold text-foreground">
          {t('remixBannerTitle', { title: initialBlueprint.title })}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t('remixBannerDesc', {
            creator: initialBlueprint.creatorId || 'anonymous',
            remixes: initialBlueprint.remixCount,
            cvr: (initialBlueprint.conversionRate * 100).toFixed(1),
          })}
        </p>
      </div>

      {/* Live Pre-Flight Cost Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/40 p-3.5 border border-white/10 text-xs">
        <div className="flex items-center gap-3">
          <Coins className="h-5 w-5 text-amber-400" />
          <div>
            <p className="font-semibold text-foreground">
              {t('costEstimate', { usd: blueprintCost.estimatedUsd, mcu: blueprintCost.totalMCU })}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t('balanceStatus', { current: initialMcuBalance, required: blueprintCost.totalMCU })}
            </p>
          </div>
        </div>

        {isAllowed ? (
          <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 font-semibold text-emerald-400">
            ✓ {t('balanceVerified')}
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 font-semibold text-amber-400">
              ⚠️ {t('insufficientMcu', { missing: missingMcu })}
            </span>
            <Link
              href="/dashboard/billing/topup"
              className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90 transition"
            >
              {t('topupMcu')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
