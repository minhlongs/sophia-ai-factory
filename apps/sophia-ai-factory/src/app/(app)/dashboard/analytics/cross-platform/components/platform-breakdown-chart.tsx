// i18n-namespace: dashboard.analytics
'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { COLORS, type ChannelMetric, type ROIMetric } from './types';

interface PlatformBreakdownChartProps {
  channels: ChannelMetric[];
  roi: ROIMetric[];
}

export function PlatformBreakdownChart({ channels, roi }: PlatformBreakdownChartProps) {
  const t = useTranslations('dashboard.analytics');

  const pieData = useMemo(
    () => channels.map((c) => ({ name: c.channel, value: c.eventCount })),
    [channels],
  );

  const roiBarData = useMemo(
    () =>
      roi.map((r) => ({
        name: r.channel,
        revenue: Math.round(r.revenueCents / 100),
        cost: Math.round(r.costCents / 100),
        roi: r.roi,
      })),
    [roi],
  );

  return (
    <>
      {channels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('event_distribution')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={120}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ percent }: { percent?: number }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {roi.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('roi_by_channel')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roiBarData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" />
                  <YAxis stroke="var(--muted-foreground)" />
                  <Tooltip
                    formatter={(value: unknown) => [
                      `$${Number(value ?? 0)}`,
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cost" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
