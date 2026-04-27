'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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
import type { LicenseUtilization } from '@/lib/analytics/types';

export interface LicenseUtilizationChartProps {
  data: LicenseUtilization[] | null;
  loading?: boolean;
  title?: string;
  userTier?: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
}

// Tier colors - matching the badge component
const TIER_COLORS: Record<string, string> = {
  BASIC: '#3b82f6',
  PREMIUM: '#8b5cf6',
  ENTERPRISE: '#10b981',
  MASTER: '#f59e0b',
};

interface ChartDataPoint {
  name: string;
  usedCredits: number;
  availableCredits: number;
  percentage: number;
  tier: string;
  expiresAt: number | null;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: unknown[] }) {
  if (active && payload && payload.length) {
    const data = (payload[0] as { payload: ChartDataPoint }).payload;
    const formatCredits = (num: number) => {
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
      if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
      return num.toLocaleString();
    };

    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={data.tier.toLowerCase() as any}>
            {data.tier}
          </Badge>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">Used:</span>
            <span className="text-xs font-medium text-foreground">
              {formatCredits(data.usedCredits)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">Available:</span>
            <span className="text-xs font-medium text-foreground">
              {formatCredits(data.availableCredits)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">Utilization:</span>
            <span className="text-xs font-medium text-foreground">
              {data.percentage.toFixed(1)}%
            </span>
          </div>
          {data.expiresAt && (
            <div className="flex items-center justify-between gap-4 pt-1 border-t border-border">
              <span className="text-xs text-muted-foreground">Expires:</span>
              <span className="text-xs font-medium text-foreground">
                {new Date(data.expiresAt * 1000).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}

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

    // Group by tier and aggregate
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

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full rounded-lg" />
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
          <div className="h-[300px] w-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
            <p className="text-sm">{t('no_licenses') || 'No licenses found'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // For BASIC users, show simplified view
  if (!isAdvanced) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
            <p className="text-sm font-medium">Advanced Analytics</p>
            <p className="text-xs mt-1">Upgrade to Growth or higher to view license utilization</p>
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
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
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
