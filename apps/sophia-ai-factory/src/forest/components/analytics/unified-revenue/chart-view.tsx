'use client';

/**
 * Unified Revenue Chart View Component
 * Layer: forest/components/analytics/unified-revenue
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Skeleton } from '@/seed/components/ui/skeleton';
import { DollarSign } from 'lucide-react';
import { formatCurrency } from '@/land/analytics/formatters';
import { Period, UnifiedRevenueSummary, fmtAxisDate } from './types';
import { PeriodToggle } from './period-toggle';
import { RevenueAreaChartCanvas } from './revenue-area-chart-canvas';

export function UnifiedRevenueChart() {
  const [period, setPeriod] = useState<Period>('30d');
  const [data, setData] = useState<UnifiedRevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/analytics/revenue-unified?period=${period}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<UnifiedRevenueSummary>;
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [period]);

  const chartData = (data?.dailySeries ?? []).map((d) => ({
    ...d,
    label: fmtAxisDate(d.date, period),
  }));

  const totalLabel = period === '7d' ? 'last 7 days' : period === '90d' ? 'last 90 days' : 'this month';

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <DollarSign size={18} />
            Unified Revenue
          </CardTitle>
          <PeriodToggle value={period} onChange={setPeriod} />
        </div>
        {data && !loading && (
          <p className="text-sm text-muted-foreground mt-1">
            Total revenue {totalLabel}:{' '}
            <span className="font-bold text-foreground text-base">
              {formatCurrency(data.totalThisMonth)}
            </span>
          </p>
        )}
      </CardHeader>
      <CardContent>
        {loading && <Skeleton className="h-56 w-full rounded-lg" />}
        {error && (
          <p className="text-sm text-red-500 py-4 text-center">
            Failed to load revenue data: {error}
          </p>
        )}
        {!loading && !error && data && (
          <RevenueAreaChartCanvas chartData={chartData} byVertical={data.byVertical} />
        )}
      </CardContent>
    </Card>
  );
}
