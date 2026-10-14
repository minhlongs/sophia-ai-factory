'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useTranslations } from 'next-intl';
import {
  LicenseUtilizationChartProps,
  ChartDataPoint,
  TIER_COLORS,
} from './types';
import { CustomTooltip } from './tooltip';
import { LoadingState, EmptyState, BasicTierState } from './empty-states';

export function LicenseUtilizationChart({
  data,
  loading,
  title = 'License Utilization by Tier',
  userTier = 'BASIC',
}: LicenseUtilizationChartProps) {
  const t = useTranslations('dashboard.analytics');
  const isAdvanced = userTier !== 'BASIC';

  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!data) return [];

    const byTier: Record<string, { used: number; available: number; count: number }> = {};

    data.forEach((license) => {
      const tier = license.tier;
      if (!byTier[tier]) {
        byTier[tier] = { used: 0, available: 0, count: 0 };
      }
      byTier[tier].used += license.usedCredits;
      byTier[tier].available += license.limitCredit;
      byTier[tier].count += 1;
    });

    return Object.entries(byTier).map(([tier, values]) => ({
      name: tier,
      usedCredits: values.used,
      availableCredits: values.available - values.used,
      percentage: values.available > 0 ? (values.used / values.available) * 100 : 0,
      tier,
      expiresAt: null,
    }));
  }, [data]);

  if (loading) return <LoadingState title={title} />;
  if (!data || data.length === 0) return <EmptyState title={title} emptyText={t('no_licenses') || 'No licenses found'} />;
  if (!isAdvanced) return <BasicTierState title={title} />;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
              <XAxis
                type="number"
                stroke="var(--muted-foreground)"
                fontSize={12}
                tick={{ fill: 'var(--muted-foreground)' }}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                  return value.toString();
                }}
              />
              <YAxis
                dataKey="name"
                type="category"
                width={100}
                stroke="var(--muted-foreground)"
                fontSize={12}
                tick={{ fill: 'var(--muted-foreground)' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{
                  color: 'var(--foreground)',
                  paddingTop: '10px',
                }}
              />
              <Bar
                dataKey="usedCredits"
                name="Used Credits"
                stackId="utilization"
                radius={[0, 4, 4, 0]}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={TIER_COLORS[entry.tier] || TIER_COLORS.BASIC}
                  />
                ))}
              </Bar>
              <Bar
                dataKey="availableCredits"
                name="Available Credits"
                stackId="utilization"
                fill="var(--muted)"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
