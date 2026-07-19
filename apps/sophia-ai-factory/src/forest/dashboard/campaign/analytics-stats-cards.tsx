/**
 * AnalyticsStatsCards — Reusable stat cards for campaign analytics.
 *
 * Layer: Forest (infrastructure orchestrators)
 * Displays: total campaigns, success rate, average completion time, completed/failed counts
 * Responsive: 3 cols desktop, 1 col mobile
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { cn } from '@/seed/utils/cn';
import { useTranslations } from 'next-intl';
import { BarChart3, CheckCircle2, Clock } from 'lucide-react';
import type { AnalyticsStatsCardsProps } from './types';

interface StatItem {
  labelKey: string;
  value: string | number;
  Icon: React.ElementType;
  subKey?: string;
}

export function AnalyticsStatsCards({
  totalCampaigns,
  successRate,
  avgCompletionTimeHours,
  completedCount,
  failedCount,
  className,
}: AnalyticsStatsCardsProps) {
  const t = useTranslations('dashboard.analytics');

  const stats: StatItem[] = [
    {
      labelKey: 'total_campaigns',
      value: totalCampaigns.toLocaleString(),
      Icon: BarChart3,
      subKey: 'all_time',
    },
    {
      labelKey: 'success_rate',
      value: `${successRate.toFixed(1)}%`,
      Icon: CheckCircle2,
      subKey: undefined,
    },
    {
      labelKey: 'avg_completion_time',
      value: `${avgCompletionTimeHours.toFixed(1)}m`,
      Icon: Clock,
      subKey: 'per_completed',
    },
  ];

  return (
    <div
      className={cn('grid gap-4 md:grid-cols-3', className)}
      aria-label="Campaign analytics stats"
    >
      {stats.map(({ labelKey, value, Icon, subKey }) => (
        <Card
          key={labelKey}
          className="bg-muted/10 border-border/50 backdrop-blur-md transition-all duration-300 hover:border-border"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">
              {t(labelKey)}
            </CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{value}</div>
            {subKey && (
              <p className="text-xs text-muted-foreground mt-1">
                {t(subKey)}
              </p>
            )}
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span>
                {t('completed_campaigns')}: {completedCount}
              </span>
              <span>
                {t('failed_requests')}: {failedCount}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

AnalyticsStatsCards.displayName = 'AnalyticsStatsCards';
