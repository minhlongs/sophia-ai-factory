'use client';

import React from 'react';
import {
  DollarSign,
  Users,
  TrendingUp,
  Handshake,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  Filter,
  ArrowRight,
} from 'lucide-react';
import {
  DashboardLayout,
  Card,
  CardHeader,
  CardContent,
  Table,
  Badge,
  Button,
  Avatar,
} from '@/components/stitch';
import { useTranslations } from 'next-intl';
import type { DashboardData, DashboardMetric } from '@/forest/dashboard/types';

interface DashboardPageProps {
  initialData?: DashboardData;
}

// Icon mapping for standard metrics
const metricIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  revenue: DollarSign,
  subscribers: Users,
  growth: TrendingUp,
  commission: Handshake,
};

export default function DashboardPage({ initialData }: DashboardPageProps) {
  const t = useTranslations('stitch.dashboard');

  // Merge provided data with fallbacks
  const metrics: DashboardMetric[] = initialData?.metrics || [
    { id: 'revenue', value: '$124,500', change: '+4.5%', trend: 'up', icon: 'DollarSign' },
    { id: 'subscribers', value: '1,240', change: '+12%', trend: 'up', icon: 'Users' },
    { id: 'growth', value: '12.5%', change: '+12.5%', trend: 'up', icon: 'TrendingUp' },
    { id: 'commission', value: '$8,200', change: 'Weekly', trend: 'neutral', icon: 'Handshake' },
  ];

  const topAffiliates = initialData?.topAffiliates || [
    {
      id: '1',
      name: 'Sarah Jenkins',
      initials: 'SJ',
      stats: '24 Sales • $1,200',
      commission: '+$450',
      avatar: null,
    },
    {
      id: '2',
      name: 'Mark Thompson',
      initials: 'MT',
      stats: '18 Sales • $940',
      commission: '+$310',
      avatar: null,
    },
    {
      id: '3',
      name: 'Lydia Wells',
      initials: 'LW',
      stats: '12 Sales • $600',
      commission: '+$220',
      avatar: null,
    },
    {
      id: '4',
      name: 'James Chen',
      initials: 'JC',
      stats: '8 Sales • $410',
      commission: '+$105',
      avatar: null,
    },
  ];

  // Transform recentActivities into transactions (filter by payment type)
  const recentTransactions = initialData?.recentActivities
    ?.filter(a => a.type === 'payment')
    .map(a => ({
      id: a.id,
      date: a.date,
      customer: a.description,
      amount: a.amount || '$0.00',
      status: a.status,
    })) || [
    { id: '1', date: 'Oct 24, 2023', customer: 'John Doe', amount: '$99.00', status: 'paid' },
    { id: '2', date: 'Oct 24, 2023', customer: 'Maria Smith', amount: '$149.00', status: 'paid' },
    { id: '3', date: 'Oct 23, 2023', customer: 'Robert King', amount: '$99.00', status: 'pending' },
    { id: '4', date: 'Oct 23, 2023', customer: 'Linda Blair', amount: '$49.00', status: 'paid' },
  ];

  const chartData = [40, 60, 45, 85, 70, 95, 65];

  // Period options for the chart selector
  const periodOptions = [
    { key: '30d', label: t('revenueChart.periods.30d') },
    { key: '6m', label: t('revenueChart.periods.6m') },
    { key: 'ytd', label: t('revenueChart.periods.ytd') },
  ];

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
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg mb-xl">
        {metrics.map((metric) => {
          const IconComponent = metricIconMap[metric.id] || DollarSign;
          return (
            <Card key={metric.id} hoverable>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="p-sm bg-surface-container rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <IconComponent className="w-5 h-5" />
                  </div>
                  {metric.trend === 'up' && (
                    <Badge variant="soft" color="success" size="sm">
                      <ArrowUpRight className="w-3 h-3 mr-0.5" />
                      {metric.change}
                    </Badge>
                  )}
                  {metric.trend === 'neutral' && (
                    <Badge variant="soft" color="neutral" size="sm">
                      {metric.change}
                    </Badge>
                  )}
                  {metric.trend === 'down' && (
                    <Badge variant="soft" color="destructive" size="sm">
                      <ArrowDownRight className="w-3 h-3 mr-0.5" />
                      {metric.change}
                    </Badge>
                  )}
                </div>
                <p className="text-on-surface-variant font-label-md mt-md mb-xs">
                  {t(`metrics.${metric.id}`)}
                </p>
                <h3 className="text-on-surface font-headline-md">{metric.value}</h3>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {/* Chart & Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg mb-xl">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2" padding="lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-headline-sm text-headline-sm text-on-surface">
                  {t('revenueChart.title')}
                </h4>
                <p className="font-label-md text-label-md text-on-surface-variant">
                  {t('revenueChart.subtitle')}
                </p>
              </div>
              <select className="bg-surface-container-low border-none rounded-xl text-label-sm font-label-sm focus:ring-primary-container pr-8">
                {periodOptions.map(opt => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-between gap-base pt-md">
              {chartData.map((height, idx) => (
                <div
                  key={idx}
                  className="w-full bg-primary/10 rounded-t-lg relative group flex-1"
                  style={{ height: '100%' }}
                >
                  <div
                    className="absolute inset-0 bg-primary rounded-t-lg transition-all duration-500 group-hover:bg-primary-container"
                    style={{ height: `${height}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-md px-base text-on-surface-variant font-label-sm">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>
          </CardContent>
        </Card>

        {/* Top Affiliates */}
        <Card padding="lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h4 className="font-headline-sm text-headline-sm text-on-surface">
                {t('topAffiliates.title')}
              </h4>
              <Button variant="ghost" size="sm" className="text-primary">
                {t('topAffiliates.viewAll')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-md">
              {topAffiliates.map((affiliate) => (
                <div key={affiliate.id} className="flex items-center gap-md">
                  <Avatar
                    src={affiliate.avatar}
                    alt={affiliate.name}
                    initials={affiliate.initials}
                    size="md"
                  />
                  <div className="flex-1">
                    <p className="font-label-md text-on-surface">{affiliate.name}</p>
                    <p className="text-[12px] text-on-surface-variant">{affiliate.stats}</p>
                  </div>
                  <div className="text-emerald-600 font-label-md">{affiliate.commission}</div>
                </div>
              ))}
            </div>
            <div className="mt-lg pt-lg border-t border-outline-variant">
              <Button variant="outline" fullWidth>
                {t('topAffiliates.invite')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions Table - Responsive wrapper */}
      <Card padding="none">
        <div className="p-lg border-b border-outline-variant flex items-center justify-between">
          <div>
            <h4 className="font-headline-sm text-headline-sm text-on-surface">
              {t('recentTransactions.title')}
            </h4>
            <p className="font-label-md text-label-md text-on-surface-variant">
              {t('recentTransactions.subtitle')}
            </p>
          </div>
          <div className="flex gap-sm">
            <Button variant="ghost" size="sm">
              <Filter className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table
            data={recentTransactions}
            columns={[
              { key: 'date', header: t('recentTransactions.columns.date'), cell: (row) => (
                <span className="font-code text-sm text-on-surface-variant">{row.date}</span>
              ) },
              { key: 'customer', header: t('recentTransactions.columns.customer'), cell: (row) => (
                <div className="flex items-center gap-sm">
                  <Avatar
                    src={null}
                    alt={row.customer}
                    initials={row.customer.charAt(0)}
                    size="sm"
                  />
                  <span className="font-label-md text-on-surface">{row.customer}</span>
                </div>
              ) },
              { key: 'amount', header: t('recentTransactions.columns.amount'), cell: (row) => (
                <span className="font-semibold text-on-surface">{row.amount}</span>
              ), align: 'right' as const },
              { key: 'status', header: t('recentTransactions.columns.status'), cell: (row) => (
                <Badge
                  variant="soft"
                  color={row.status === 'paid' ? 'success' : row.status === 'failed' ? 'destructive' : 'neutral'}
                  size="sm"
                >
                  {t(`common.${row.status}`)}
                </Badge>
              )},
              { key: 'action', header: t('recentTransactions.columns.action'), cell: () => (
                <Button variant="ghost" size="sm">
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ), align: 'right' as const },
            ]}
            getRowId={(row) => row.id}
          />
        </div>
        <div className="p-md bg-surface-container-lowest flex items-center justify-between border-t border-outline-variant">
          <p className="text-label-sm text-on-surface-variant">
            {t('recentTransactions.showing', { from: 1, to: recentTransactions.length, total: 1240 })}
          </p>
          <div className="flex gap-sm">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm">
              Next
            </Button>
          </div>
        </div>
      </Card>
    </DashboardLayout>
  );
}
