'use client';

import React from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  type DashboardOverviewProps,
  DEFAULT_METRICS,
  DEFAULT_CAMPAIGNS,
} from './types';
import { MetricsSummary } from './metrics-summary';
import { RecentActivity } from './recent-activity';
import { QuickActions } from './quick-actions';

export type { DashboardOverviewProps } from './types';

export function DashboardOverview({
  kpiMetrics,
  campaigns,
}: DashboardOverviewProps) {
  const t = useTranslations('stitch.dashboardOverview');

  const metrics = kpiMetrics ?? DEFAULT_METRICS;
  const rows = campaigns ?? DEFAULT_CAMPAIGNS;

  return (
    <main
      className="flex-1 overflow-y-auto p-4 sm:p-8"
      aria-label={t('aria.mainContent')}
    >
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-white tracking-tight">
            {t('title')}
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            {t('subtitle')}
          </p>
        </div>
        <div
          className="flex items-center gap-2 h-10 bg-surface-container-high px-4 rounded-lg border border-outline-variant/10 cursor-pointer hover:bg-surface-container-highest transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          role="button"
          tabIndex={0}
          aria-label={t('periodSelector.ariaLabel')}
        >
          <CalendarDays className="w-4 h-4 text-on-surface-variant" aria-hidden="true" />
          <span className="text-sm font-medium">{t('periodSelector.label')}</span>
          <ChevronDown className="w-4 h-4 text-on-surface-variant" aria-hidden="true" />
        </div>
      </div>

      {/* ── KPI Row & Performance Chart ─────────────────────────── */}
      <MetricsSummary metrics={metrics} />

      {/* ── Bottom Split (Campaigns & Quick Actions) ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <RecentActivity rows={rows} />
        <QuickActions />
      </div>
    </main>
  );
}

export default DashboardOverview;
