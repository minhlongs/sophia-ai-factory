/**
 * Client component for Social Metrics page.
 * Renders summary cards + Recharts engagement line chart.
 */

'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent } from '@/seed/components/ui/card';

const CHANNEL_COLORS = [
  '#8b5cf6',
  '#3b82f6',
  '#10b981',
  '#ef4444',
  '#f59e0b',
  '#06b6d4',
  '#ec4899',
  '#6366f1',
];

interface RawMetric {
  day: string;
  channel: string;
  views: number;
  likes: number;
  shares: number;
}

interface MetricsClientProps {
  userId: string;
  channels: string[];
  rawData: RawMetric[];
}

type DateRangeKey = '7d' | '30d' | '90d';

export default function MetricsClient({
  channels,
  rawData,
}: MetricsClientProps) {
  const t = useTranslations('socialPages.metrics');
  const [dateRange, setDateRange] = useState<DateRangeKey>('30d');

  const filteredData = useMemo(() => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    return rawData.filter((row) => row.day >= cutoffStr);
  }, [rawData, dateRange]);

  // Pivot: { date: { channel: engagementRate } }
  const pivot = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const row of filteredData) {
      if (!map.has(row.day)) map.set(row.day, { date: row.day });
      const views = row.views ?? 0;
      const engagement =
        views > 0
          ? Math.round(((row.likes ?? 0) + (row.shares ?? 0)) / views * 1000) / 10
          : 0;
      map.get(row.day)![row.channel] = engagement;
    }
    return Array.from(map.values()).sort((a, b) => (a.date > b.date ? 1 : -1));
  }, [filteredData]);

  // Summary stats
  const stats = useMemo(() => {
    let totalViews = 0;
    const channelEngagement = new Map<string, { rateSum: number; count: number }>();
    let topChannel = '';
    let topRate = -1;

    for (const row of filteredData) {
      totalViews += row.views ?? 0;
      const rate =
        (row.views ?? 0) > 0
          ? ((row.likes ?? 0) + (row.shares ?? 0)) / (row.views ?? 1)
          : 0;
      const existing = channelEngagement.get(row.channel) ?? { rateSum: 0, count: 0 };
      existing.rateSum += rate;
      existing.count += 1;
      channelEngagement.set(row.channel, existing);

      if (rate > topRate) {
        topRate = rate;
        topChannel = row.channel;
      }
    }

    const avgRate =
      channels.length > 0
        ? Math.round(
            (Array.from(channelEngagement.values()).reduce(
              (s, c) => s + c.rateSum / c.count,
              0,
            ) /
              channels.length) *
              100,
          ) / 100
        : 0;

    return { totalViews, avgRate, topChannel: topRate >= 0 ? topChannel : null, topRate };
  }, [filteredData, channels]);

  if (channels.length === 0 && filteredData.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">{t('noData')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {(
            [
              ['7d', t('last7Days')],
              ['30d', t('last30Days')],
              ['90d', t('last90Days')],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setDateRange(key)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                dateRange === key
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border hover:bg-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('totalViews')}</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {stats.totalViews.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('avgEngagementRate')}</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {(stats.avgRate * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('topChannel')}</p>
            <p className="text-2xl font-bold text-foreground mt-1 capitalize">
              {stats.topChannel ?? '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-medium text-foreground mb-4">{t('chartTitle')}</p>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pivot} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  stroke="var(--muted-foreground)"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                  formatter={(val: number) => [`${val}%`, 'Engagement']}
                />
                <Legend />
                {channels.map((ch, i) => (
                  <Line
                    key={ch}
                    type="monotone"
                    dataKey={ch}
                    stroke={CHANNEL_COLORS[i % CHANNEL_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    name={ch.toUpperCase()}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
