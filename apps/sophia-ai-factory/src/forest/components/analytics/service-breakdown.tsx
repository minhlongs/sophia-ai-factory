'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Skeleton } from '@/seed/components/ui/skeleton';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { useTranslations } from 'next-intl';
import type { ServiceBreakdown } from '@/land/analytics/types';
import {
  SERVICE_COLORS,
  CustomTooltip,
  type CustomTooltipProps,
} from './service-breakdown-tooltip';

export { SERVICE_COLORS, CustomTooltip, type CustomTooltipProps };

export interface ServiceBreakdownChartProps {
  data: ServiceBreakdown[] | null;
  loading?: boolean;
  title?: string;
  onSelectService?: (service: string) => void;
}

export function ServiceBreakdownChart({
  data,
  loading,
  title = 'Usage by Service',
  onSelectService,
}: ServiceBreakdownChartProps) {
  const t = useTranslations('dashboard.analytics');

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
            <p className="text-sm">{t('no_data') || 'No data available'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    name: item.service.charAt(0).toUpperCase() + item.service.slice(1),
  }));

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name }) => `${name}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="credits"
                nameKey="name"
                onClick={(data) => onSelectService?.((data as { service?: string }).service ?? '')}
                style={{ cursor: onSelectService ? 'pointer' : 'default' }}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      SERVICE_COLORS[entry.service.toLowerCase()] ||
                      SERVICE_COLORS.default
                    }
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{
                  color: 'var(--foreground)',
                  paddingTop: '10px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
