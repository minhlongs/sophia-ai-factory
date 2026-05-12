'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/seed/components/ui/card';
import { Button } from '@/seed/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/seed/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/seed/components/ui/tabs';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import type { AnalyticsGranularity } from '@/lib/analytics/types';
import { useUsageAnalytics } from './hooks/use-usage-analytics';
import { OverviewTab } from './components/overview-tab';
import { UsageTrendsTab } from './components/usage-trends-tab';
import { LicenseTab } from './components/license-tab';

export default function UsageAnalyticsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const {
    granularity,
    setGranularity,
    isLoading,
    error,
    usageMetrics,
    licenseMetrics,
    refresh,
  } = useUsageAnalytics();

  const handleGranularityChange = (value: AnalyticsGranularity) => {
    setGranularity(value);
  };

  return (
    <div className="space-y-6">
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
          <Button variant="outline" size="icon" onClick={refresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'motion-safe:animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              <span className="font-medium">Error loading data:</span>
              <span className="text-sm">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

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

        <TabsContent value="overview" className="mt-6">
          <OverviewTab
            usageMetrics={usageMetrics}
            licenseMetrics={licenseMetrics}
            granularity={granularity}
          />
        </TabsContent>

        <TabsContent value="usage" className="mt-6">
          <UsageTrendsTab usageMetrics={usageMetrics} granularity={granularity} />
        </TabsContent>

        <TabsContent value="licenses" className="mt-6">
          <LicenseTab licenseMetrics={licenseMetrics} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
