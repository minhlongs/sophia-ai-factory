'use client';

/**
 * Usage Analytics Dashboard
 * /admin/analytics/usage - Per-license metrics dashboard
 *
 * Displays:
 * - API calls over time (UsageChart)
 * - Quota utilization (QuotaGauge)
 * - Error trends (ErrorRateChart)
 * - License metrics table (LicenseMetricsTable)
 */

import { useState, useEffect, useCallback } from 'react';
import { UsageChart } from '@/components/analytics/UsageChart';
import { QuotaGaugeList } from '@/components/analytics/QuotaGauge';
import { ErrorRateChart } from '@/components/analytics/ErrorRateChart';
import { LicenseMetricsTable } from '@/components/analytics/LicenseMetricsTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, TrendingUp, AlertTriangle, Zap } from 'lucide-react';
import type { UsageMetrics, LicenseMetrics, AnalyticsGranularity } from '@/lib/analytics/types';
import { logger } from '@/lib/utils/logger-utility';

export default function UsageAnalyticsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [granularity, setGranularity] = useState<AnalyticsGranularity>('hour');
  const [isLoading, setIsLoading] = useState(false);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);
  const [licenseMetrics, setLicenseMetrics] = useState<LicenseMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Calculate default date range (last 24 hours or 7 days)
  const getDateRange = useCallback(() => {
    const now = Math.floor(Date.now() / 1000);
    const start = granularity === 'hour'
      ? now - (24 * 3600) // Last 24 hours
      : now - (7 * 86400); // Last 7 days

    return { start, end: now };
  }, [granularity]);

  // Fetch usage metrics
  const fetchUsageMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { start, end } = getDateRange();
      const params = new URLSearchParams({
        start: start.toString(),
        end: end.toString(),
        granularity,
      });

      const response = await fetch(`/api/analytics/usage?${params}`);

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || 'Failed to fetch usage metrics');
      }

      const data: UsageMetrics = await response.json();
      setUsageMetrics(data);
      logger.info('[Usage Analytics] Fetched usage metrics', {
        totalRequests: data.summary.totalRequests,
        totalCredits: data.summary.totalCredits,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      logger.error('[Usage Analytics] Failed to fetch usage metrics', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [granularity, getDateRange]);

  // Fetch license metrics
  const fetchLicenseMetrics = useCallback(async () => {
    try {
      const response = await fetch('/api/analytics/licenses?status=all');

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || 'Failed to fetch license metrics');
      }

      const data: LicenseMetrics = await response.json();
      setLicenseMetrics(data);
      logger.info('[Usage Analytics] Fetched license metrics', {
        total: data.total,
        utilizationCount: data.utilization.length,
      });
    } catch (err) {
      logger.error('[Usage Analytics] Failed to fetch license metrics', err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchUsageMetrics();
    fetchLicenseMetrics();
  }, [fetchUsageMetrics, fetchLicenseMetrics]);

  // Refresh handler
  const handleRefresh = () => {
    fetchUsageMetrics();
    fetchLicenseMetrics();
  };

  // Granularity change handler
  const handleGranularityChange = (value: AnalyticsGranularity) => {
    setGranularity(value);
  };

  // Build quota data for gauge display
  const quotaData = usageMetrics
    ? [
        {
          label: 'Total Credits',
          used: usageMetrics.summary.totalCredits,
          limit: 100000, // Default limit for overview
        },
        {
          label: 'API Requests',
          used: usageMetrics.summary.totalRequests,
          limit: 50000, // Default limit for overview
        },
        {
          label: 'Total Tokens',
          used: usageMetrics.summary.totalTokensInput + usageMetrics.summary.totalTokensOutput,
          limit: 10000000, // Default limit for overview
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Usage Analytics</h1>
          <p className="text-muted-foreground">
            Per-license metrics, API calls, quota utilization, and error trends
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={granularity} onValueChange={handleGranularityChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Granularity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hour">Hourly</SelectItem>
              <SelectItem value="day">Daily</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Error loading data:</span>
              <span className="text-sm">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-muted border border-border">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-[var(--neon-cyan)]/10 data-[state=active]:text-[var(--neon-cyan)]"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="usage"
            className="data-[state=active]:bg-[var(--neon-cyan)]/10 data-[state=active]:text-[var(--neon-cyan)]"
          >
            Usage Trends
          </TabsTrigger>
          <TabsTrigger
            value="licenses"
            className="data-[state=active]:bg-[var(--neon-cyan)]/10 data-[state=active]:text-[var(--neon-cyan)]"
          >
            Per-License
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Summary Cards */}
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
                <p className="text-xs text-muted-foreground mt-1">
                  Credits consumed
                </p>
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
                <p className="text-xs text-muted-foreground mt-1">
                  Failed requests
                </p>
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
                  {licenseMetrics?.utilization.filter(l => l.percentage > 0).length || 0} with usage
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quota Gauges */}
          <Card>
            <CardHeader>
              <CardTitle>Quota Utilization</CardTitle>
              <CardDescription>Current usage vs limits</CardDescription>
            </CardHeader>
            <CardContent>
              {quotaData.length > 0 ? (
                <QuotaGaugeList quotas={quotaData} columns={3} />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No quota data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mini Usage Chart */}
          <Card>
            <CardHeader>
              <CardTitle>API Calls Over Time</CardTitle>
              <CardDescription>
                {granularity === 'hour' ? 'Hourly breakdown (24h)' : 'Daily breakdown (7d)'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usageMetrics?.timeSeries && usageMetrics.timeSeries.length > 0 ? (
                <UsageChart
                  data={usageMetrics.timeSeries}
                  granularity={granularity}
                  height={300}
                />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No usage data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usage Trends Tab */}
        <TabsContent value="usage" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Usage Trends</CardTitle>
              <CardDescription>API requests and credits over time</CardDescription>
            </CardHeader>
            <CardContent>
              {usageMetrics?.timeSeries && usageMetrics.timeSeries.length > 0 ? (
                <UsageChart
                  data={usageMetrics.timeSeries}
                  granularity={granularity}
                  showCredits={true}
                  showTokens={false}
                  height={400}
                />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No usage data available
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Error Rate Trends</CardTitle>
              <CardDescription>Errors and error rate percentage over time</CardDescription>
            </CardHeader>
            <CardContent>
              {usageMetrics?.timeSeries && usageMetrics.timeSeries.length > 0 ? (
                <ErrorRateChart
                  data={usageMetrics.timeSeries}
                  granularity={granularity}
                  height={300}
                />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No error data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Per-License Tab */}
        <TabsContent value="licenses" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Per-License Metrics</CardTitle>
              <CardDescription>
                Usage breakdown by license with quota tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              {licenseMetrics?.utilization && licenseMetrics.utilization.length > 0 ? (
                <LicenseMetricsTable
                  licenses={licenseMetrics.utilization}
                  isLoading={isLoading}
                />
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No license data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
