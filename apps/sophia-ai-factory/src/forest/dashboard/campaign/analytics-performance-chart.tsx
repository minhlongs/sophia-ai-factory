/**
 * AnalyticsPerformanceChart — Reusable bar chart for campaign completion times.
 *
 * Layer: Forest (infrastructure orchestrators)
 * Uses recharts BarChart with horizontal layout.
 * Displays top N campaigns by completion time duration.
 * Has tooltip + responsive container.
 * Colors: campaigns use purple (#8b5cf6) bars with rounded corners.
 */

'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTranslations } from 'next-intl';
import { cn } from '@/seed/utils/cn';
import type { AnalyticsPerformanceChartProps } from './types';

export function AnalyticsPerformanceChart({ data, className }: AnalyticsPerformanceChartProps) {
  const t = useTranslations('dashboard.analytics');

  if (data.length === 0) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground border border-dashed border-border/50 rounded-lg">
        {t('no_completed_data')}
      </div>
    );
  }

  return (
    <div className={cn('h-[300px] w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis type="number" unit="m" stroke="var(--muted-foreground)" />
          <YAxis
            dataKey="name"
            type="category"
            width={90}
            stroke="var(--muted-foreground)"
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)' }}
            contentStyle={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
            itemStyle={{ color: 'var(--foreground)' }}
          />
          <Bar
            dataKey="duration"
            name={t('duration_min')}
            fill="#8b5cf6"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

AnalyticsPerformanceChart.displayName = 'AnalyticsPerformanceChart';
