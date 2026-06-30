/**
 * AnalyticsStatusChart — Reusable pie chart for campaign status distribution.
 *
 * Layer: Forest (infrastructure orchestrators)
 * Uses recharts PieChart with status-specific colors:
 *   completed -> green (#10b981)
 *   processing (queued, processing_script, processing_video) -> yellow (#f59e0b)
 *   failed -> red (#ef4444)
 *   video_timeout -> red (#ef4444)
 *   draft -> gray (#6b7280)
 *   unknown -> gray (#6b7280)
 * Has legend + tooltip + responsive container
 */

'use client';

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useTranslations } from 'next-intl';
import { cn } from '@/seed/utils/cn';
import type { AnalyticsStatusChartProps } from './types';

const STATUS_COLORS: Record<string, string> = {
  completed: '#10b981',
  queued: '#f59e0b',
  processing_script: '#f59e0b',
  processing_video: '#f59e0b',
  failed: '#ef4444',
  video_timeout: '#ef4444',
  draft: '#6b7280',
};

function getStatusColor(name: string): string {
  const lower = name.toLowerCase();
  return STATUS_COLORS[lower] ?? '#6b7280';
}

export function AnalyticsStatusChart({ data, className }: AnalyticsStatusChartProps) {
  const t = useTranslations('dashboard.analytics');

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center text-muted-foreground border border-dashed border-border/50 rounded-lg">
        {t('no_data')}
      </div>
    );
  }

  return (
    <div className={cn('h-[300px] w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) =>
              `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
            }
            outerRadius={80}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={getStatusColor(entry.name)} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
            itemStyle={{ color: 'var(--foreground)' }}
          />
          <Legend
            wrapperStyle={{ color: 'var(--foreground)' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

AnalyticsStatusChart.displayName = 'AnalyticsStatusChart';
