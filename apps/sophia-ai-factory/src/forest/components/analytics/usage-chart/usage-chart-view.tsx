'use client';

/**
 * Usage Chart Main View Component
 *
 * Layer: forest/components/analytics
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Skeleton } from '@/seed/components/ui/skeleton';
import { useTranslations } from 'next-intl';
import type { UsageChartProps, ChartDataPoint } from './types';
import { formatTimestamp } from './types';
import { ChartContainer } from './chart-container';

export function UsageChart({
  data,
  metric: _metric,
  granularity,
  loading,
  title = 'Usage Over Time',
}: UsageChartProps) {
  const t = useTranslations('dashboard.analytics');

  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!data) return [];
    return data.map((point) => ({
      timestamp: point.timestamp,
      formattedTime: formatTimestamp(point.timestamp, granularity),
      requests: point.requests,
      credits: point.credits,
      tokens: point.tokens,
    }));
  }, [data, granularity]);

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[350px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] w-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
            <p className="text-sm">{t('no_data') || 'No data available'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer chartData={chartData} />
      </CardContent>
    </Card>
  );
}
