'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { cn } from '@/seed/utils/cn';
import {
  Megaphone,
  Play,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CampaignMetricsCardProps } from './types';

interface MetricItem {
  labelKey: string;
  valueKey: keyof CampaignMetricsCardProps['metrics'];
  Icon: React.ElementType;
}

const METRIC_ITEMS: MetricItem[] = [
  { labelKey: 'total_campaigns', valueKey: 'totalCampaigns', Icon: Megaphone },
  { labelKey: 'active_campaigns', valueKey: 'activeCampaigns', Icon: Play },
  { labelKey: 'completed_campaigns', valueKey: 'completedCampaigns', Icon: CheckCircle },
  { labelKey: 'success_rate', valueKey: 'successRate', Icon: TrendingUp },
];

export function CampaignMetricsCard({
  metrics,
  className,
}: CampaignMetricsCardProps) {
  const t = useTranslations('dashboard.campaigns.metrics');

  return (
    <div
      className={cn('grid grid-cols-2 md:grid-cols-4 gap-4', className)}
      aria-label="Campaign metrics"
    >
      {METRIC_ITEMS.map(({ labelKey, valueKey, Icon }) => {
        const rawValue = metrics[valueKey];
        const value = valueKey === 'successRate'
          ? `${rawValue.toFixed(1)}%`
          : rawValue.toLocaleString();
        return (
          <Card key={labelKey} className="bg-surface-container-lowest border-outline-variant">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-on-surface-variant">
                {t(labelKey)}
              </CardTitle>
              <div className="p-2 bg-surface-container rounded-xl text-primary">
                <Icon className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-on-surface">{value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

CampaignMetricsCard.displayName = 'CampaignMetricsCard';
