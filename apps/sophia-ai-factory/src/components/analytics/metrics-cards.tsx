'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Activity, Database, Coins, Clock, AlertCircle, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface UsageMetricsData {
  requests: number;
  tokens: number;
  credits: number;
  responseTime: number;
  errorRate: number;
  cost?: number;
  requestsTrend?: number;
  tokensTrend?: number;
  creditsTrend?: number;
}

export interface MetricsCardsProps {
  metrics: UsageMetricsData | null;
  period: string;
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  userTier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
}

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: number;
  loading?: boolean;
  footer?: string;
}

function MetricCard({ title, value, icon, trend, loading, footer }: MetricCardProps) {
  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">{title}</CardTitle>
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24 mb-1" />
          <Skeleton className="h-3 w-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="flex items-center gap-2 mt-1">
          {trend !== undefined && (
            <>
              {trend >= 0 ? (
                <TrendingUp className="h-3 w-3 text-emerald-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={cn(
                "text-xs",
                trend >= 0 ? "text-emerald-500" : "text-red-500"
              )}>
                {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
              </span>
            </>
          )}
          {footer && (
            <span className="text-xs text-muted-foreground">{footer}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function MetricsCards({ metrics, period, loading, error, onRetry, userTier }: MetricsCardsProps) {
  if (error) {
    return (
      <Card className="bg-card border-border">
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

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <MetricCard
        title="Total Requests"
        value={metrics ? formatNumber(metrics.requests) : '0'}
        icon={<Activity className="h-4 w-4 text-muted-foreground" />}
        trend={metrics?.requestsTrend}
        loading={loading}
        footer="All requests"
      />

      <MetricCard
        title="Total Tokens"
        value={metrics ? formatNumber(metrics.tokens) : '0'}
        icon={<Database className="h-4 w-4 text-muted-foreground" />}
        trend={metrics?.tokensTrend}
        loading={loading}
        footer="Input + Output"
      />

      <MetricCard
        title="Credits Used"
        value={metrics ? formatNumber(metrics.credits) : '0'}
        icon={<Coins className="h-4 w-4 text-muted-foreground" />}
        trend={metrics?.creditsTrend}
        loading={loading}
        footer={period}
      />

      <MetricCard
        title="Avg Response Time"
        value={metrics ? `${metrics.responseTime.toFixed(0)}ms` : '0ms'}
        icon={<Clock className="h-4 w-4 text-muted-foreground" />}
        loading={loading}
        footer="Per request"
      />

      <MetricCard
        title="Error Rate"
        value={metrics ? `${metrics.errorRate.toFixed(2)}%` : '0%'}
        icon={<AlertCircle className="h-4 w-4 text-muted-foreground" />}
        loading={loading}
        footer="Failed requests"
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
