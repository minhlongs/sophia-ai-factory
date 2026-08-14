'use client';

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  MoreVertical,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/seed/utils/cn';
import { Card } from '@/seed/components/ui/card';
import { AdminChartSection } from './admin-chart-section';
import { AdminSystemHealth } from './admin-system-health';
import { AdminSignupsTable } from './admin-signups-table';
import { BellIcon } from './admin-bell-icon';
import {
  DEFAULT_KPI,
  DEFAULT_SERVICES,
  DEFAULT_SIGNUPS,
  DEFAULT_DEPLOY,
  DEFAULT_TABS,
} from './admin-page-types';
import type { AdminPageContentProps, KpiData } from './admin-page-types';

// Re-export extracted modules for barrel compatibility
export type { KpiData, SystemService, SignupUser, DeployStatus, AdminPageContentProps } from './admin-page-types';
export { DEFAULT_KPI, DEFAULT_SERVICES, DEFAULT_SIGNUPS, DEFAULT_DEPLOY, DEFAULT_TABS } from './admin-page-types';
export { AdminChartSection } from './admin-chart-section';
export { AdminSystemHealth } from './admin-system-health';
export { AdminSignupsTable } from './admin-signups-table';
export { BellIcon } from './admin-bell-icon';

/* ── KPI Card ────────────────────────────────────────────────────────────── */

function KpiCard({ metric, t }: { metric: KpiData; t: (key: string) => string }) {
  return (
    <Card glass className="p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          {t(`kpi.${metric.id}.label`)}
        </span>
        {metric.trendDirection && (
          metric.trendDirection === 'up'
            ? <TrendingUp className="w-4 h-4 text-emerald-500" aria-hidden="true" />
            : <TrendingDown className="w-4 h-4 text-error" aria-hidden="true" />
        )}
        {metric.trendLabel && (
          <span className="text-xs text-on-surface-variant font-medium">{metric.trendLabel}</span>
        )}
      </div>
      <h3 className="text-2xl font-bold text-on-surface">{metric.value}</h3>
      {(metric.trend || metric.trendSub) && (
        <div className="flex items-center gap-2 mt-2">
          {metric.trend && (
            <span
              className={cn(
                'text-xs font-bold',
                metric.trendDirection === 'up' ? 'text-emerald-500' : 'text-error'
              )}
            >
              {metric.trend}
            </span>
          )}
          {metric.trendSub && (
            <span className="text-xs text-on-surface-variant">{metric.trendSub}</span>
          )}
        </div>
      )}
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * AdminPageContent
 * ═══════════════════════════════════════════════════════════════════════════ */

export default function AdminPageContent({
  kpiMetrics,
  services,
  signups,
  deployInfo,
  title = 'Admin Dashboard',
  badgeLabel = 'Pro',
  headerTabs,
}: AdminPageContentProps) {
  const t = useTranslations('stitch.admin');

  const kpis = kpiMetrics ?? DEFAULT_KPI;
  const svcList = services ?? DEFAULT_SERVICES;
  const signupRows = signups ?? DEFAULT_SIGNUPS;
  const deploy = deployInfo ?? DEFAULT_DEPLOY;
  const tabs = headerTabs ?? DEFAULT_TABS;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-outline-variant bg-surface/80 backdrop-blur-lg">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-on-surface">{title}</h1>
            <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold uppercase">
              {badgeLabel}
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-6 mr-6" aria-label={t('aria.headerNav')}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={
                  tab.active
                    ? 'text-primary border-b-2 border-primary pb-1 text-sm font-medium'
                    : 'text-on-surface-variant pb-1 text-sm font-medium hover:text-primary transition-colors'
                }
                aria-current={tab.active ? 'page' : undefined}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2 border-l border-outline-variant pl-4">
            <button
              type="button"
              className="relative p-2 text-on-surface-variant hover:text-on-surface transition-colors"
              aria-label={t('aria.notifications')}
            >
              <BellIcon />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="p-2 text-on-surface-variant hover:text-on-surface transition-colors"
              aria-label={t('aria.moreOptions')}
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-6 py-8">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {kpis.map((metric) => (
            <KpiCard key={metric.id} metric={metric} t={(k) => t(k)} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Chart */}
          <div className="lg:col-span-2 space-y-6">
            <AdminChartSection />
          </div>

          {/* Right column: System Health */}
          <div className="space-y-6">
            <AdminSystemHealth services={svcList} />
          </div>
        </div>

        {/* Recent Signups Table */}
        <div className="mt-6">
          <AdminSignupsTable signups={signupRows} />
        </div>

        {/* Deploy Footer */}
        <div className="mt-6 flex items-center justify-between p-4 rounded-xl bg-surface-container border border-outline-variant">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-hidden="true" />
            <span className="text-xs font-medium text-on-surface-variant">
              {t('deploy.status')}: <span className="text-on-surface font-bold">{deploy.sha}</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3 text-on-surface-variant" aria-hidden="true" />
              <span className="text-xs text-on-surface-variant">{deploy.ago}</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase">
              {deploy.env}
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

AdminPageContent.displayName = 'AdminPageContent';
