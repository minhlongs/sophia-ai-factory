/**
 * Admin Console Submodule: Stats Overview Cards.
 * Layer: forest/components (UI presentation; imports from @/seed and @/tree)
 *
 * @module forest/components/handover/admin-console/admin-stats-overview
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/seed/components/ui/card';
import type { CustomerHandoverRecord } from '@/seed/handover/handover-types';
import type { HandoverAdminConsoleStats } from './types';

interface AdminStatsOverviewProps {
  stats: HandoverAdminConsoleStats;
  handovers: CustomerHandoverRecord[];
}

export function AdminStatsOverview({ stats, handovers }: AdminStatsOverviewProps) {
  const t = useTranslations('admin.handover');
  const atRiskCount = handovers.filter((h) => h.status === 'at_risk').length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <Card className="p-5 border-border/60 bg-card/60">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
          {t('stats.total')}
        </span>
        <div className="text-2xl font-black text-foreground">{stats.total}</div>
        <span className="text-[11px] text-muted-foreground mt-1 block">Provisioned Studios</span>
      </Card>

      <Card className="p-5 border-border/60 bg-card/60">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
          {t('stats.accepted')}
        </span>
        <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
          {stats.accepted}
        </div>
        <span className="text-[11px] text-emerald-600/80 font-medium mt-1 block">
          {stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0}% Acceptance Rate
        </span>
      </Card>

      <Card className="p-5 border-border/60 bg-card/60">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
          {t('stats.pending')}
        </span>
        <div className="text-2xl font-black text-amber-500">{stats.pending}</div>
        <span className="text-[11px] text-muted-foreground mt-1 block">Awaiting Customer Sign</span>
      </Card>

      <Card className="p-5 border-border/60 bg-card/60">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
          {t('stats.active')}
        </span>
        <div className="text-2xl font-black text-foreground">{stats.active}</div>
        <span className="text-[11px] text-muted-foreground mt-1 block">Active In Production</span>
      </Card>

      <Card className="p-5 border-border/60 bg-card/60 col-span-2 lg:col-span-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
          {t('stats.atRisk')}
        </span>
        <div className="text-2xl font-black text-foreground">
          {atRiskCount}
        </div>
        <span className="text-[11px] text-muted-foreground mt-1 block">Needs Operator Review</span>
      </Card>
    </div>
  );
}
