'use client';

import React from 'react';
import { Download, Plus } from 'lucide-react';
import { Button } from '@/components/stitch';
import { useTranslations } from 'next-intl';
import type { DashboardData, DashboardMetric } from '@/forest/dashboard/types';
import type { SystemReadiness } from '@/tree/readiness/readiness-checker';
import { DashboardNextStepBanner } from '@/forest/dashboard/dashboard-next-step-banner';
import { DashboardOnboardingBanner } from './dashboard-onboarding-banner';
import { DashboardControlDeckBanner } from './dashboard-control-deck-banner';
import { LocalEngineSetupGuide } from '@/components/dashboard/local-engine-setup-guide';
import { DashboardMetricsGrid } from './dashboard-metrics-grid';
import { DashboardRevenueChart } from './dashboard-revenue-chart';
import { DashboardAffiliatesCard } from './dashboard-affiliates-card';
import {
  DashboardTransactionsCard,
  type DashboardTransactionItem,
} from './dashboard-transactions-card';

interface DashboardPageProps {
  initialData?: DashboardData;
  /**
   * True when the dashboard aggregator failed. Kept separate from
   * `initialData` being absent because of a successful load of an account that
   * simply has no data yet: a failed load must not render as zero KPIs.
   */
  loadFailed?: boolean;
  readiness?: SystemReadiness | null;
}

export default function DashboardPage({ initialData, loadFailed, readiness }: DashboardPageProps) {
  let t: (key: string) => string;
  try {
    const hookT = useTranslations('stitch.dashboard');
    t = (key: string) => hookT(key);
  } catch {
    t = (key: string) => key;
  }

  // A failed load is not an empty account. Rendering the zero fallback here
  // would tell a customer their numbers are zero when we simply do not know.
  const metrics: DashboardMetric[] | undefined = loadFailed
    ? undefined
    : initialData?.metrics;

  // Zero-mock affiliates: empty if none provided
  const topAffiliates = initialData?.topAffiliates || [];

  // Same rule as the metrics: no recent activity data after a failed load is
  // "unknown", not "nothing happened".
  const recentTransactions: DashboardTransactionItem[] | undefined = loadFailed
    ? undefined
    : initialData?.recentActivities?.map((a) => ({
        id: a.id,
        date: a.date,
        customer: a.description,
        amount: a.amount || (a.type === 'campaign' ? 'AI Video Mission' : '$0.00'),
        status: a.status,
      }));

  return (
    <div className="space-y-6" data-testid="dashboard-overview-content">
      {/* Dashboard Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground dark:text-white tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" iconLeft={<Download className="w-4 h-4" />}>
            {t('actions.exportData')}
          </Button>
          <Button iconLeft={<Plus className="w-4 h-4" />}>
            {t('actions.addProduct')}
          </Button>
        </div>
      </div>

      {/* The one action that matches the customer's current state */}
      <DashboardNextStepBanner readiness={readiness} initialData={initialData} />

      {/* CEO Onboarding & System Readiness Callout */}
      <DashboardOnboardingBanner readiness={readiness} />

      {/* Stitch v4.2 Director's Control Deck 9-Screen Quick Launch */}
      <DashboardControlDeckBanner />

      {/* Metrics Grid */}
      <DashboardMetricsGrid metrics={metrics} />

      {/* Chart & Affiliates Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <DashboardRevenueChart
          // Keep "the server reported nothing" distinct from "the load failed":
          // an empty array is a real verified-empty period, whereas `undefined`
          // makes the chart say the figure is unavailable instead of $0.
          data={loadFailed ? undefined : initialData?.revenueData}
        />
        <DashboardAffiliatesCard affiliates={topAffiliates} />
      </div>

      {/* Recent Activity Table */}
      <DashboardTransactionsCard transactions={recentTransactions} />

      {/* Optional local rendering engine, kept out of the primary work area. */}
      <details className="rounded-2xl border border-border bg-muted/20 p-4">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
          {t('advanced.localEngineLabel')}
        </summary>
        <div className="mt-4">
          <LocalEngineSetupGuide />
        </div>
      </details>
    </div>
  );
}
