'use client';

/**
 * Unified Revenue Chart View Component
 * Layer: forest/components/analytics/unified-revenue
 */

import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Skeleton } from '@/seed/components/ui/skeleton';
import { DollarSign } from 'lucide-react';
import { formatCurrency } from '@/land/analytics/formatters';
import {
  Period,
  UnifiedRevenueSummary,
  VERTICAL_COLORS,
  VERTICAL_LABELS,
  fmtAxisDate,
} from './types';
import { CustomTooltip } from './chart-tooltip';
import { PeriodToggle } from './period-toggle';

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
          <>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  {(['saas', 'crypto', 'product'] as const).map((v) => (
                    <linearGradient key={v} id={`grad-${v}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={VERTICAL_COLORS[v]} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={VERTICAL_COLORS[v]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(v) => VERTICAL_LABELS[v as keyof typeof VERTICAL_LABELS] ?? v}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '12px' }}
                />
                {(['saas', 'crypto', 'product'] as const).map((v) => (
                  <Area
                    key={v}
                    type="monotone"
                    dataKey={v}
                    name={v}
                    stackId="1"
                    stroke={VERTICAL_COLORS[v]}
                    strokeWidth={2}
                    fill={`url(#grad-${v})`}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex gap-3 mt-4 flex-wrap">
              {(['saas', 'crypto', 'product'] as const).map((v) => (
                <div
                  key={v}
                  className="flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
                  style={{ backgroundColor: `${VERTICAL_COLORS[v]}20`, color: VERTICAL_COLORS[v] }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: VERTICAL_COLORS[v] }}
                  />
                  {VERTICAL_LABELS[v]}: {formatCurrency(data.byVertical[v])}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
