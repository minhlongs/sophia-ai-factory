'use client';

import React from 'react';
import {
  Megaphone,
  Play,
  Video,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
} from 'lucide-react';
import { Card, CardHeader, Badge } from '@/components/stitch';
import { useTranslations } from 'next-intl';
import type { DashboardMetric } from '@/forest/dashboard/types';

interface DashboardMetricsGridProps {
  metrics: DashboardMetric[];
}

const metricIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  total_campaigns: Megaphone,
  active_campaigns: Play,
  videos_generated: Video,
  success_rate: TrendingUp,
};

export function DashboardMetricsGrid({ metrics }: DashboardMetricsGridProps) {
  const t = useTranslations('stitch.dashboard');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg mb-xl">
      {metrics.map((metric) => {
        const IconComponent = metricIconMap[metric.id] || DollarSign;
        return (
          <Card key={metric.id} hoverable>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="p-sm bg-surface-container rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <IconComponent className="w-5 h-5" />
                </div>
                {metric.trend === 'up' && (
                  <Badge variant="soft" color="success" size="sm">
                    <ArrowUpRight className="w-3 h-3 mr-0.5" />
                    {metric.change}
                  </Badge>
                )}
                {metric.trend === 'neutral' && (
                  <Badge variant="soft" color="neutral" size="sm">
                    {metric.change}
                  </Badge>
                )}
                {metric.trend === 'down' && (
                  <Badge variant="soft" color="error" size="sm">
                    <ArrowDownRight className="w-3 h-3 mr-0.5" />
                    {metric.change}
                  </Badge>
                )}
              </div>
              <p className="text-on-surface-variant font-label-md mt-md mb-xs">
                {t(`metrics.${metric.id}`)}
              </p>
              <h3 className="text-on-surface font-headline-md">{metric.value}</h3>
            </CardHeader>
          </Card>
        );
      })}
    </div>
  );
}
