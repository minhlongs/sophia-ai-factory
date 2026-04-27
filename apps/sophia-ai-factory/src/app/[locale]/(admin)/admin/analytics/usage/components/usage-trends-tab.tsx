'use client';

import { UsageChart } from '@/components/analytics/UsageChart';
import { ErrorRateChart } from '@/components/analytics/ErrorRateChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { UsageMetrics, AnalyticsGranularity } from '@/lib/analytics/types';

interface UsageTrendsTabProps {
  usageMetrics: UsageMetrics | null;
  granularity: AnalyticsGranularity;
}

export function UsageTrendsTab({ usageMetrics, granularity }: UsageTrendsTabProps) {
  return (
    <div className="space-y-6">
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
            <div className="text-center text-muted-foreground py-8">No usage data available</div>
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
            <div className="text-center text-muted-foreground py-8">No error data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
