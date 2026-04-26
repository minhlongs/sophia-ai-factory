'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
} from 'recharts';
import { useTranslations } from 'next-intl';
import type { TimeSeriesPoint } from '@/lib/analytics/types';
import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

export type UsageMetric = 'requests' | 'credits' | 'tokens';

export interface UsageChartProps {
  data: TimeSeriesPoint[] | null;
  metric: UsageMetric;
  granularity: 'hour' | 'day';
  loading?: boolean;
  title?: string;
}

interface ChartDataPoint {
  timestamp: number;
  formattedTime: string;
  requests: number;
  credits: number;
  tokens: number;
}

function formatTimestamp(timestamp: number, granularity: 'hour' | 'day'): string {
  const date = new Date(timestamp * 1000);
  if (granularity === 'hour') {
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
    });
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

type CustomTooltipProps = TooltipProps<ValueType, NameType> & {
  payload?: Array<{ payload: ChartDataPoint }>;
  label?: string;
};

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ChartDataPoint;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-xs text-muted-foreground">Requests:</span>
            <span className="text-xs font-medium text-foreground">
              {data.requests.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-xs text-muted-foreground">Credits:</span>
            <span className="text-xs font-medium text-foreground">
              {data.credits.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs text-muted-foreground">Tokens:</span>
            <span className="text-xs font-medium text-foreground">
              {data.tokens.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export function UsageChart({ data, metric, granularity, loading, title = 'Usage Over Time' }: UsageChartProps) {
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

  const gradientOffset = () => {
    if (!data || data.length === 0) return 0;
    const max = Math.max(...data.map((d) => d[metric]));
    const min = Math.min(...data.map((d) => d[metric]));
    if (max === min) return 0.5;
    return (0 - min) / (max - min);
  };

  const off = gradientOffset();

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{
                top: 10,
                right: 30,
                left: 0,
                bottom: 0,
              }}
            >
              <defs>
                <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCredits" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
              <XAxis
                dataKey="formattedTime"
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickMargin={10}
                tick={{ fill: 'var(--muted-foreground)' }}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={12}
                tick={{ fill: 'var(--muted-foreground)' }}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                  return value.toString();
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{
                  color: 'var(--foreground)',
                }}
              />
              <Area
                type="monotone"
                dataKey="requests"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRequests)"
                name="Requests"
              />
              <Area
                type="monotone"
                dataKey="credits"
                stroke="#8b5cf6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCredits)"
                name="Credits"
              />
              <Area
                type="monotone"
                dataKey="tokens"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorTokens)"
                name="Tokens"
              />
              <Brush
                dataKey="formattedTime"
                height={30}
                stroke="#8b5cf6"
                travellerWidth={10}
                tickFormatter={(value: string) => value.slice(0, 6)}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
