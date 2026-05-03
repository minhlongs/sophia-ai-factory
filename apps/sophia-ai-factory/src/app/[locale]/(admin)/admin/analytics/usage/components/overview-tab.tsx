'use client';

import { UsageChart } from '@/forest/components/analytics/UsageChart';
import { QuotaGaugeList } from '@/forest/components/analytics/QuotaGauge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { TrendingUp, AlertTriangle, Zap } from 'lucide-react';
import type { UsageMetrics, LicenseMetrics, AnalyticsGranularity } from '@/lib/analytics/types';

interface OverviewTabProps {
  usageMetrics: UsageMetrics | null;
  licenseMetrics: LicenseMetrics | null;
  granularity: AnalyticsGranularity;
}

export function OverviewTab({ usageMetrics, licenseMetrics, granularity }: OverviewTabProps) {
  const quotaData = usageMetrics
    ? [
        {
          label: 'Total Credits',
          used: usageMetrics.summary.totalCredits,
          limit: 100000,
        },
        {
          label: 'API Requests',
          used: usageMetrics.summary.totalRequests,
          limit: 50000,
        },
        {
          label: 'Total Tokens',
          used: usageMetrics.summary.totalTokensInput + usageMetrics.summary.totalTokensOutput,
          limit: 10000000,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usageMetrics?.summary.totalRequests.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {granularity === 'hour' ? 'Last 24 hours' : 'Last 7 days'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
            <Zap className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usageMetrics?.summary.totalCredits.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Credits consumed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usageMetrics?.summary.errorRate.toFixed(2) || '0.00'}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Failed requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Licenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {licenseMetrics?.total.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {licenseMetrics?.utilization.filter((l) => l.percentage > 0).length || 0} with usage
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quota Utilization</CardTitle>
          <CardDescription>Current usage vs limits</CardDescription>
        </CardHeader>
        <CardContent>
          {quotaData.length > 0 ? (
            <QuotaGaugeList quotas={quotaData} columns={3} />
          ) : (
            <div className="text-center text-muted-foreground py-8">No quota data available</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Calls Over Time</CardTitle>
          <CardDescription>
            {granularity === 'hour' ? 'Hourly breakdown (24h)' : 'Daily breakdown (7d)'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usageMetrics?.timeSeries && usageMetrics.timeSeries.length > 0 ? (
            <UsageChart data={usageMetrics.timeSeries} granularity={granularity} height={300} />
          ) : (
            <div className="text-center text-muted-foreground py-8">No usage data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
