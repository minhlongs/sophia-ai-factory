'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Lock, RefreshCw } from 'lucide-react';
import { Tier } from '@/types';
import { MetricsCards } from '@/components/analytics/metrics-cards';
import { UsageChart, UsageMetric } from '@/components/analytics/usage-chart';
import { ServiceBreakdownChart } from '@/components/analytics/service-breakdown';
import { LicenseUtilizationChart } from '@/components/analytics/license-utilization';
import { useUsageMetrics, useLicenseMetrics } from '@/hooks/analytics';
import { DateRangePicker } from '@/components/analytics/date-range-picker';
import { TierFilter } from '@/components/analytics/tier-filter';
import { CustomerSearch } from '@/components/analytics/customer-search';
import { ExportButton } from '@/components/analytics/export-button';
import { getAnalyticsAccess } from '@/lib/analytics/rbac';
import { downloadCsv } from '@/lib/analytics/export';
import { DateRange } from 'react-day-picker';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';

interface UsageAnalyticsViewProps {
  userTier: Tier;
  userId: string;
}

export function UsageAnalyticsView({ userTier, userId }: UsageAnalyticsViewProps) {
  const t = useTranslations('dashboard.analytics');

  // Date range state - now using DateRange object
  const [dateRangePreset, setDateRangePreset] = useState<'24h' | '7d' | '30d' | '90d'>('24h');
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [metric, setMetric] = useState<UsageMetric>('requests');
  const [selectedTiers, setSelectedTiers] = useState<Tier[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Get feature access
  const access = useMemo(() => getAnalyticsAccess(userTier, userTier === 'MASTER'), [userTier]);

  // Calculate timestamps based on date range
  const { start, end } = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);

    // Use custom date range if available, otherwise use preset
    if (customDateRange?.from) {
      const fromTimestamp = Math.floor(customDateRange.from.getTime() / 1000);
      const toTimestamp = customDateRange.to
        ? Math.floor(customDateRange.to.getTime() / 1000)
        : now;
      return { start: fromTimestamp, end: toTimestamp };
    }

    const ranges = {
      '24h': 24 * 3600,
      '7d': 7 * 24 * 3600,
      '30d': 30 * 24 * 3600,
      '90d': 90 * 24 * 3600,
    };
    return {
      start: now - ranges[dateRangePreset],
      end: now,
    };
  }, [dateRangePreset, customDateRange]);

  // Fetch usage data with TanStack Query (80% API reduction with caching)
  const { data: usageData, isLoading: usageLoading, error: usageError, refetch: refreshUsage } = useUsageMetrics({
    start,
    end,
    granularity: dateRangePreset === '24h' ? 'hour' : 'day',
    enabled: true,
  });

  // Fetch license data with TanStack Query
  const { data: licenseData, isLoading: licenseLoading, error: licenseError, refetch: refreshLicenses } = useLicenseMetrics({
    enabled: access.canViewTierBreakdown,
  });

  // Transform usage data for metrics cards
  const metricsData = useMemo(() => {
    if (!usageData?.summary) return null;

    const summary = usageData.summary;
    return {
      requests: summary.totalRequests,
      tokens: summary.totalTokensInput + summary.totalTokensOutput,
      credits: summary.totalCredits,
      responseTime: summary.avgResponseTimeMs,
      errorRate: summary.errorRate,
      // Cost calculation (example: $0.01 per credit)
      cost: summary.totalCredits * 0.01,
    };
  }, [usageData]);

  // Check if user can export (PREMIUM+ only)
  const canExport = access.canExport;

  const handleExport = useCallback(async (format: 'csv' | 'png') => {
    if (!usageData || !canExport) return;

    setIsExporting(true);
    try {
      if (format === 'csv') {
        const res = await fetch('/api/analytics/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start,
            end,
            format: 'csv',
          }),
        });

        if (!res.ok) throw new Error('Export failed');

        const blob = await res.blob();
        const filename = `analytics-${start}-${end}.csv`;

        // Download CSV
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        // PNG export (chart screenshot)
        const { exportChartToPng } = await import('@/lib/analytics/chart-export');
        await exportChartToPng('usage-chart', `usage-analytics-${Date.now()}`);
      }
    } catch (error) {
      logger.error('Export failed', toError(error));
    } finally {
      setIsExporting(false);
    }
  }, [usageData, canExport, start, end]);

  const handleRefresh = useCallback(() => {
    refreshUsage();
    refreshLicenses();
  }, [refreshUsage, refreshLicenses]);

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Range Picker - Custom range for PREMIUM+ */}
          {access.canViewCustomDateRange ? (
            <DateRangePicker
              value={customDateRange}
              onChange={(range) => {
                setCustomDateRange(range);
                setDateRangePreset('24h'); // Reset preset when using custom
              }}
              maxRangeDays={90}
            />
          ) : (
            <Select value={dateRangePreset} onValueChange={(v: string) => setDateRangePreset(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t('date_range')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">{t('last_24h')}</SelectItem>
                <SelectItem value="7d">{t('last_7d')}</SelectItem>
                <SelectItem value="30d">{t('last_30d')}</SelectItem>
                <SelectItem value="90d">{t('last_90d')}</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Tier Filter - Admin only */}
          {access.canViewCustomerTable && (
            <TierFilter
              selectedTiers={selectedTiers}
              onChange={setSelectedTiers}
              adminOnly={false}
            />
          )}

          {/* Customer Search - Admin only */}
          {access.canViewCustomerTable && (
            <CustomerSearch
              onSelect={setSelectedCustomer}
              onClear={() => setSelectedCustomer(null)}
              adminOnly={false}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Metric Selector */}
          <Select value={metric} onValueChange={(v: string) => setMetric(v)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Metric" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="requests">Requests</SelectItem>
              <SelectItem value="credits">Credits</SelectItem>
              <SelectItem value="tokens">Tokens</SelectItem>
            </SelectContent>
          </Select>

          {/* Auto-refresh toggle - ENTERPRISE+ */}
          {access.canAutoRefresh && (
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              title={autoRefresh ? 'Auto-refresh ON (30s)' : 'Enable auto-refresh'}
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            </Button>
          )}

          {/* Manual Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={usageLoading}
          >
            <RefreshCw className={`w-4 h-4 ${usageLoading ? 'animate-spin' : ''}`} />
          </Button>

          {/* Export Button */}
          <ExportButton
            disabled={!canExport}
            loading={isExporting}
            onExport={handleExport}
            dateRange={customDateRange || { from: new Date(start * 1000), to: new Date(end * 1000) }}
            upgradeHint={t('export_disabled_hint')}
          />
        </div>
      </div>

      {/* Metrics Cards */}
      <MetricsCards
        metrics={metricsData}
        period={dateRangePreset}
        loading={usageLoading}
        error={usageError}
        userTier={userTier}
      />

      {/* Usage Chart */}
      <div id="usage-chart">
        <UsageChart
          data={usageData?.timeSeries || null}
          metric={metric}
          granularity={dateRangePreset === '24h' ? 'hour' : 'day'}
          loading={usageLoading}
          title={t('usage_over_time')}
        />
      </div>

      {/* Service Breakdown and License Utilization */}
      <div className="grid gap-6 md:grid-cols-2">
        <ServiceBreakdownChart
          data={usageData?.serviceBreakdown || null}
          loading={usageLoading}
          title={t('service_breakdown')}
        />

        <LicenseUtilizationChart
          data={licenseData?.utilization || null}
          loading={licenseLoading}
          title={t('license_utilization')}
          userTier={userTier}
        />
      </div>

      {/* Tier Gating Notice for BASIC users */}
      {userTier === 'BASIC' && (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Lock className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium text-foreground">{t('advanced_analytics')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('upgrade_for_details')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
