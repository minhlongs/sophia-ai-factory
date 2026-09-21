'use client';

import React from 'react';
import { Download, Plus } from 'lucide-react';
import { Button } from '@/components/stitch';
import { useTranslations } from 'next-intl';
import type { DashboardData, DashboardMetric } from '@/forest/dashboard/types';
import type { SystemReadiness } from '@/tree/readiness/readiness-checker';
import { DashboardOnboardingBanner } from './dashboard-onboarding-banner';
import { DashboardMetricsGrid } from './dashboard-metrics-grid';
import { DashboardRevenueChart } from './dashboard-revenue-chart';
import { DashboardAffiliatesCard } from './dashboard-affiliates-card';
import {
  DashboardTransactionsCard,
  type DashboardTransactionItem,
} from './dashboard-transactions-card';

interface DashboardPageProps {
  initialData?: DashboardData;
  readiness?: SystemReadiness | null;
}

export default function DashboardPage({ initialData, readiness }: DashboardPageProps) {
  let t: (key: string) => string;
  try {
    const hookT = useTranslations('stitch.dashboard');
    t = (key: string) => hookT(key);
  } catch {
    t = (key: string) => key;
  }

  // Fallback default empty metrics
  const metrics: DashboardMetric[] = initialData?.metrics || [
    { id: 'total_campaigns', value: '0', change: '0%', trend: 'neutral', icon: 'Megaphone' },
    { id: 'active_campaigns', value: '0', change: '0%', trend: 'neutral', icon: 'Play' },
    { id: 'videos_generated', value: '0', change: '0%', trend: 'neutral', icon: 'Video' },
    { id: 'success_rate', value: '0%', change: '0%', trend: 'neutral', icon: 'TrendingUp' },
  ];

  // Zero-mock affiliates: empty if none provided
  const topAffiliates = initialData?.topAffiliates || [];

  // Support all activities (campaigns/missions + transactions)
  const recentTransactions: DashboardTransactionItem[] =
    initialData?.recentActivities?.map((a) => ({
      id: a.id,
      date: a.date,
      customer: a.description,
      amount: a.amount || (a.type === 'campaign' ? 'AI Video Mission' : '$0.00'),
      status: a.status,
    })) || [];

  return (
    <div className="space-y-6" data-testid="dashboard-overview-content">
      {/* Dashboard Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{t('title')}</h1>
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

      {/* CEO Onboarding & System Readiness Callout */}
      <DashboardOnboardingBanner readiness={readiness} />

      {/* Metrics Grid */}
      <DashboardMetricsGrid metrics={metrics} />

      {/* Chart & Affiliates Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <DashboardRevenueChart />
        <DashboardAffiliatesCard affiliates={topAffiliates} />
      </div>

      {/* Recent Activity Table */}
      <DashboardTransactionsCard transactions={recentTransactions} />
    </div>
  );
}
