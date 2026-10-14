'use client';

import React from 'react';
import { MoreVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AdminChartSection } from './admin-chart-section';
import { AdminSystemHealth } from './admin-system-health';
import { AdminSignupsTable } from './admin-signups-table';
import { BellIcon } from './admin-bell-icon';
import { AdminKpiCard, AdminDeployFooter } from './admin-kpi-card';
import {
  DEFAULT_KPI,
  DEFAULT_SERVICES,
  DEFAULT_SIGNUPS,
  DEFAULT_DEPLOY,
  DEFAULT_TABS,
} from './admin-page-types';
import type { AdminPageContentProps } from './admin-page-types';

// Re-export extracted modules for barrel compatibility
export type { KpiData, SystemService, SignupUser, DeployStatus, AdminPageContentProps } from './admin-page-types';
export { DEFAULT_KPI, DEFAULT_SERVICES, DEFAULT_SIGNUPS, DEFAULT_DEPLOY, DEFAULT_TABS } from './admin-page-types';
export { AdminChartSection } from './admin-chart-section';
export { AdminSystemHealth } from './admin-system-health';
export { AdminSignupsTable } from './admin-signups-table';
export { BellIcon } from './admin-bell-icon';

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {kpis.map((metric) => (
            <AdminKpiCard key={metric.id} metric={metric} t={(k) => t(k)} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <AdminChartSection />
          </div>
          <div className="space-y-6">
            <AdminSystemHealth services={svcList} />
          </div>
        </div>

        <div className="mt-6">
          <AdminSignupsTable signups={signupRows} />
        </div>

        <AdminDeployFooter deploy={deploy} t={(k) => t(k)} />
      </main>
    </div>
  );
}

AdminPageContent.displayName = 'AdminPageContent';
