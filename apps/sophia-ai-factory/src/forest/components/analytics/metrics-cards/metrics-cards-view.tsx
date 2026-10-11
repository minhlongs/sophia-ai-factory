'use client';

import React from 'react';
import { Card, CardContent } from '@/seed/components/ui/card';
import { Activity, Database, Coins, Clock, AlertCircle, DollarSign } from 'lucide-react';
import { getMcuMonthlyLimit } from '@/seed/config/tiers';
import type { MetricsCardsProps } from './types';
import { MetricCard } from './metric-card-item';

export function MetricsCardsView({
  metrics,
  period,
  loading,
  error,
  onRetry,
  userTier,
}: MetricsCardsProps) {
  if (error) {
    return (
      <Card className="bg-muted/10 border-border/50 backdrop-blur-md">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <AlertCircle className="h-8 w-8 text-destructive mb-2" />
          <p className="text-sm text-destructive mb-2">Failed to load metrics</p>
          <button
            onClick={onRetry}
            className="text-sm text-primary hover:underline"
          >
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const isAdvanced = userTier !== 'BASIC';
  const mcuLimit = getMcuMonthlyLimit(userTier);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <MetricCard
        title="Total Requests"
        value={metrics ? formatNumber(metrics.requests) : '0'}
        icon={<Activity className="h-4 w-4 text-muted-foreground" />}
        trend={metrics?.requestsTrend}
        loading={loading}
        footer="All requests"
        sparklineData={metrics?.requestsSparkline}
        sparklineColor="rgb(139, 92, 246)" // violet-500
      />

      <MetricCard
        title="Total Tokens"
        value={metrics ? formatNumber(metrics.tokens) : '0'}
        icon={<Database className="h-4 w-4 text-muted-foreground" />}
        trend={metrics?.tokensTrend}
        loading={loading}
        footer="Input + Output"
        sparklineData={metrics?.tokensSparkline}
        sparklineColor="rgb(6, 182, 212)" // cyan-500
      />

      <MetricCard
        title="Credits Used"
        value={metrics ? formatNumber(metrics.credits) : '0'}
        icon={<Coins className="h-4 w-4 text-muted-foreground" />}
        trend={metrics?.creditsTrend}
        loading={loading}
        footer={`${period} (${formatNumber(mcuLimit)} max)`}
        sparklineData={metrics?.creditsSparkline}
        sparklineColor="rgb(16, 185, 129)" // emerald-500
        progressRing={{
          used: metrics?.credits ?? 0,
          limit: mcuLimit,
        }}
      />

      <MetricCard
        title="Avg Response Time"
        value={metrics ? `${metrics.responseTime.toFixed(0)}ms` : '0ms'}
        icon={<Clock className="h-4 w-4 text-muted-foreground" />}
        loading={loading}
        footer="Per request"
        sparklineData={metrics?.responseTimeSparkline}
        sparklineColor="rgb(245, 158, 11)" // amber-500
      />

      <MetricCard
        title="Error Rate"
        value={metrics ? `${metrics.errorRate.toFixed(2)}%` : '0%'}
        icon={<AlertCircle className="h-4 w-4 text-muted-foreground" />}
        loading={loading}
        footer="Failed requests"
        sparklineData={metrics?.errorRateSparkline}
        sparklineColor="rgb(244, 63, 94)" // rose-500
      />

      {isAdvanced && (
        <MetricCard
          title="Est. Cost"
          value={metrics?.cost ? `$${metrics.cost.toFixed(2)}` : '$0.00'}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          loading={loading}
          footer="Based on usage"
        />
      )}
    </div>
  );
}
