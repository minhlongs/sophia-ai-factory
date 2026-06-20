'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  MoreVertical,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  RefreshCw,
} from 'lucide-react';
import {
  DashboardLayout,
  Card,
  CardHeader,
  CardContent,
  Table,
  Badge,
  Button,
} from '@/components/stitch';
import { fetchCampaignDashboardData } from '@/land/billing/campaign-dashboard';
import type { CampaignDashboardData, CampaignDashboardItem } from '@/land/billing/campaign-dashboard/campaign-dashboard-types';

// Custom ProgressBar component (Stitch UI doesn't have this)
function ProgressBar({ value, max = 100, color = 'primary', size = 'md' }: { value: number; max?: number; color?: string; size?: string }) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const heightClass = size === 'sm' ? 'h-1' : 'h-2';
  const colorClass = color === 'error' ? 'bg-error' : color === 'warning' ? 'bg-warning' : 'bg-primary';

  return (
    <div className={`w-full bg-outline-variant/30 rounded-full ${heightClass} overflow-hidden`}>
      <div
        className={`${heightClass} ${colorClass} rounded-full transition-all duration-300`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export default function CampaignDashboardPage() {
  const t = useTranslations('campaign-dashboard');
  const [data, setData] = useState<CampaignDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('active');

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCampaignDashboardData({
        status: statusFilter === 'all' ? undefined : statusFilter as 'active' | 'expired' | 'revoked',
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaign data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="soft" color="success"><CheckCircle className="w-3 h-3 mr-1" />{t('status.active')}</Badge>;
      case 'expired':
        return <Badge variant="soft" color="neutral"><Clock className="w-3 h-3 mr-1" />{t('status.expired')}</Badge>;
      case 'revoked':
        return <Badge variant="soft" color="error"><XCircle className="w-3 h-3 mr-1" />{t('status.revoked')}</Badge>;
      default:
        return <Badge variant="soft" color="neutral">{status}</Badge>;
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCurrency = (num: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const summaryMetrics = data ? [
    {
      id: 'total-campaigns',
      label: t('metrics.totalCampaigns'),
      value: data.summary.totalCampaigns.toString(),
      change: data.summary.activeCampaigns > 0 ? `+${data.summary.activeCampaigns} active` : 'No active',
      trend: data.summary.activeCampaigns > 0 ? 'up' as const : 'neutral' as const,
      icon: BarChart3,
    },
    {
      id: 'revenue',
      label: t('metrics.totalRevenue'),
      value: formatCurrency(data.summary.totalRevenue),
      change: data.summary.campaignsWithOverage > 0 ? `${data.summary.campaignsWithOverage} with overage` : 'No overage',
      trend: data.summary.campaignsWithOverage > 0 ? 'up' as const : 'neutral' as const,
      icon: DollarSign,
    },
    {
      id: 'utilization',
      label: t('metrics.avgUtilization'),
      value: `${data.summary.avgUtilization}%`,
      change: data.summary.avgUtilization >= 80 ? 'High usage' : 'Normal usage',
      trend: data.summary.avgUtilization >= 80 ? 'up' as const : 'neutral' as const,
      icon: Activity,
    },
    {
      id: 'overage',
      label: t('metrics.campaignsWithOverage'),
      value: data.summary.campaignsWithOverage.toString(),
      change: `${data.summary.totalCampaigns - data.summary.campaignsWithOverage} within quota`,
      trend: data.summary.campaignsWithOverage > 0 ? 'warning' as const : 'neutral' as const,
      icon: AlertCircle,
    },
  ] : [];

  if (loading) {
    return (
      <DashboardLayout
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            <Button variant="outline" iconLeft={<RefreshCw className="w-4 h-4" />} onClick={loadData}>
              {t('common.refresh')}
            </Button>
          </>
        }
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-on-surface-variant">{t('common.loading')}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            <Button variant="outline" iconLeft={<RefreshCw className="w-4 h-4" />} onClick={loadData}>
              {t('common.retry')}
            </Button>
          </>
        }
      >
        <Card padding="lg">
          <CardContent>
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-error mx-auto mb-4" />
              <h3 className="font-headline-md text-on-surface mb-2">{t('errors.loadFailed')}</h3>
              <p className="text-on-surface-variant mb-4">{error}</p>
              <Button onClick={loadData}>{t('common.retry')}</Button>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout title={t('title')} subtitle={t('subtitle')}>
        <Card padding="lg">
          <CardContent>
            <div className="text-center py-8">
              <p className="text-on-surface-variant">{t('errors.noData')}</p>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={t('title')}
      subtitle={t('subtitle')}
      actions={
        <>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-surface-container text-on-surface border border-outline rounded-lg text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
          >
            <option value="active">{t('filters.activeOnly')}</option>
            <option value="all">{t('filters.all')}</option>
            <option value="expired">{t('filters.expired')}</option>
            <option value="revoked">{t('filters.revoked')}</option>
          </select>
          <Button variant="outline" iconLeft={<RefreshCw className="w-4 h-4" />} onClick={loadData}>
            {t('common.refresh')}
          </Button>
        </>
      }
    >
      {/* Summary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg mb-xl">
        {summaryMetrics.map((metric) => (
          <Card key={metric.id} hoverable>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="p-sm bg-surface-container rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <metric.icon className="w-5 h-5" />
                </div>
                {metric.trend === 'up' && (
                  <Badge variant="soft" color="success" size="sm">
                    <ArrowUpRight className="w-3 h-3 mr-0.5" />
                    {metric.change}
                  </Badge>
                )}
                {metric.trend === 'warning' && (
                  <Badge variant="soft" color="warning" size="sm">
                    <AlertCircle className="w-3 h-3 mr-0.5" />
                    {metric.change}
                  </Badge>
                )}
                {metric.trend === 'neutral' && (
                  <Badge variant="soft" color="neutral" size="sm">
                    {metric.change}
                  </Badge>
                )}
              </div>
              <p className="text-on-surface-variant font-label-md mt-md mb-xs">
                {metric.label}
              </p>
              <h3 className="text-on-surface font-headline-md">{metric.value}</h3>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Campaign Performance Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg mb-xl">
        {/* Top Performers */}
        <Card className="lg:col-span-1" padding="lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-headline-sm text-headline-sm text-on-surface">
                  {t('topPerformers.title')}
                </h4>
                <p className="font-label-md text-label-md text-on-surface-variant">
                  {t('topPerformers.subtitle')}
                </p>
              </div>
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-md">
              {data.topPerformers.map((campaign, idx) => (
                <div key={campaign.id} className="flex items-center gap-md">
                  <div className="w-8 h-8 flex items-center justify-center bg-primary-container text-on-primary-container rounded-full font-label-sm font-semibold">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md text-on-surface truncate" title={campaign.title}>
                      {campaign.title}
                    </p>
                    <p className="text-[12px] text-on-surface-variant">
                      {t('common.tier', { tier: campaign.tier })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-label-md text-on-surface">{campaign.percentage}%</p>
                    <p className="text-[12px] text-on-surface-variant">
                      {formatNumber(campaign.usedCredits)} / {formatNumber(campaign.limitCredit)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {data.topPerformers.length === 0 && (
              <p className="text-center text-on-surface-variant py-4">
                {t('topPerformers.empty')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Utilization Distribution */}
        <Card className="lg:col-span-2" padding="lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-headline-sm text-headline-sm text-on-surface">
                  {t('utilizationChart.title')}
                </h4>
                <p className="font-label-md text-label-md text-on-surface-variant">
                  {t('utilizationChart.subtitle')}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-end justify-between gap-2 pt-4">
              {data.performanceChart?.map((point, idx) => (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <div
                    className="w-full bg-primary/10 rounded-t-sm relative group min-h-[8px]"
                    style={{ height: '100%' }}
                  >
                    <div
                      className="absolute inset-x-0 bottom-0 bg-primary rounded-t-sm transition-all duration-300 group-hover:bg-primary-container"
                      style={{ height: `${Math.max(point.views > 0 ? 50 : 0, 20)}%` }}
                    />
                  </div>
                  {idx % 7 === 0 && (
                    <span className="text-[10px] text-on-surface-variant mt-1">
                      {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-outline-variant">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-primary rounded-sm" />
                <span className="text-xs text-on-surface-variant">{t('utilizationChart.legend.views')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Details Table */}
      <Card padding="none">
        <div className="p-lg border-b border-outline-variant flex items-center justify-between">
          <div>
            <h4 className="font-headline-sm text-headline-sm text-on-surface">
              {t('campaigns.title')}
            </h4>
            <p className="font-label-md text-label-md text-on-surface-variant">
              {t('campaigns.subtitle', { count: data.campaigns?.length ?? 0 })}
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
        <Table
          data={data.campaigns}
          columns={[
            { key: 'title', header: t('campaigns.columns.name'), cell: (row: CampaignDashboardItem) => (
              <div className="flex items-center gap-sm">
                <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-on-primary-container" />
                </div>
                <div>
                  <p className="font-label-md text-on-surface">{row.title}</p>
                  <p className="text-[11px] text-on-surface-variant font-code">
                    {row.id.slice(0, 12)}...
                  </p>
                </div>
              </div>
            ) },
            { key: 'tier', header: t('campaigns.columns.tier'), cell: (row: CampaignDashboardItem) => (
              <Badge variant="soft" color="primary" size="sm">
                {row.tier}
              </Badge>
            )},
            { key: 'utilization', header: t('campaigns.columns.utilization'), cell: (row: CampaignDashboardItem) => (
              <div className="w-32">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-on-surface">{row.percentage}%</span>
                  {(row.overageCount || 0) > 0 && (
                    <span className="text-xs text-warning">{t('common.overage')}</span>
                  )}
                </div>
                <ProgressBar
                  value={row.percentage}
                  max={100}
                  color={row.percentage >= 90 ? 'error' : row.percentage >= 75 ? 'warning' : 'primary'}
                  size="sm"
                />
                <p className="text-[11px] text-on-surface-variant mt-1">
                  {formatNumber(row.usedCredits)} / {formatNumber(row.limitCredit)}
                </p>
              </div>
            )},
            { key: 'status', header: t('campaigns.columns.status'), cell: (row: CampaignDashboardItem) => (
              getStatusBadge(row.status)
            )},
            { key: 'expires', header: t('campaigns.columns.expires'), cell: (row: CampaignDashboardItem) => (
              <span className="font-code text-sm text-on-surface-variant">
                {row.expiresAt
                  ? new Date(row.expiresAt * 1000).toLocaleDateString()
                  : t('common.perpetual')}
              </span>
            )},
            { key: 'overage', header: t('campaigns.columns.overage'), cell: (row: CampaignDashboardItem) => (
              <div className="text-right">
                <p className="font-label-md text-on-surface">
                  {(row.billableCount || 0) > 0 ? formatCurrency(row.overageCredits || 0) : '-'}
                </p>
                <p className="text-[11px] text-on-surface-variant">
                  {row.overageCount || 0} {t('common.events')}
                </p>
              </div>
            )},
            { key: 'action', header: '', cell: () => (
              <Button variant="ghost" size="sm">
                <ArrowUpRight className="w-4 h-4" />
              </Button>
            ), align: 'right' as const },
          ]}
          getRowId={(row: CampaignDashboardItem) => row.id}
        />
        <div className="p-md bg-surface-container-lowest flex items-center justify-between border-t border-outline-variant">
          <p className="text-label-sm text-on-surface-variant">
            {t('campaigns.showing', { from: 1, to: data.campaigns?.length ?? 0, total: data.campaigns?.length ?? 0 })}
          </p>
        </div>
      </Card>
    </DashboardLayout>
  );
}
