'use client';

import React from 'react';
import { MoreVertical } from 'lucide-react';
import { DashboardLayout, Button } from '@/components/stitch';
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
  const t = useTranslations('stitch.dashboard');

  // Fallback default empty metrics
  const metrics: DashboardMetric[] = initialData?.metrics || [
    { id: 'total_campaigns', value: '0', change: '0%', trend: 'neutral', icon: 'Megaphone' },
    { id: 'active_campaigns', value: '0', change: '0%', trend: 'neutral', icon: 'Play' },
    { id: 'videos_generated', value: '0', change: '0%', trend: 'neutral', icon: 'Video' },
    { id: 'success_rate', value: '0%', change: '0%', trend: 'neutral', icon: 'TrendingUp' },
  ];

  // Zero-mock affiliates: empty if none provided
  const topAffiliates = initialData?.topAffiliates || [];

  // Zero-mock transactions: empty if none provided
  const recentTransactions: DashboardTransactionItem[] =
    initialData?.recentActivities
      ?.filter((a) => a.type === 'payment')
      .map((a) => ({
        id: a.id,
        date: a.date,
        customer: a.description,
        amount: a.amount || '$0.00',
        status: a.status,
      })) || [];

  return (
    <DashboardLayout
      title={t('title')}
      subtitle={t('subtitle')}
      actions={
        <>
          <Button variant="outline" iconLeft={<MoreVertical className="w-4 h-4" />}>
            {t('actions.exportData')}
          </Button>
          <Button iconLeft={<MoreVertical className="w-4 h-4" />}>
            {t('actions.addProduct')}
          </Button>
        </>
      }
    >
      {/* CEO Onboarding & System Readiness Callout */}
      <DashboardOnboardingBanner readiness={readiness} />

      {/* Metrics Grid */}
      <DashboardMetricsGrid metrics={metrics} />

      {/* Chart & Affiliates Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg mb-xl">
        <DashboardRevenueChart />
        <DashboardAffiliatesCard affiliates={topAffiliates} />
      </div>

      {/* Recent Transactions Table */}
      <DashboardTransactionsCard transactions={recentTransactions} />
    </DashboardLayout>
  );
}
