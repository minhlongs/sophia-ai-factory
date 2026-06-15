'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Skeleton } from '@/seed/components/ui/skeleton';
import { TrendingUp, TrendingDown, Activity, Database, Coins, Clock, AlertCircle, DollarSign } from 'lucide-react';
import { cn } from '@/seed/utils/cn';
import { getMcuMonthlyLimit } from '@/seed/config/tiers';

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
  // Sparkline data arrays
  requestsSparkline?: number[];
  tokensSparkline?: number[];
  creditsSparkline?: number[];
  responseTimeSparkline?: number[];
  errorRateSparkline?: number[];
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
  sparklineData?: number[];
  sparklineColor?: string;
  progressRing?: {
    used: number;
    limit: number;
  };
}

function Sparkline({ data, color = 'rgb(139, 92, 246)' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min === 0 ? 1 : max - min;
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * 100;
    const y = 30 - ((val - min) / range) * 22 - 4; // leave margin top/bottom
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  return (
    <div className="h-6 w-full mt-2 overflow-hidden">
      <svg viewBox="0 0 100 30" className="w-full h-full overflow-visible" preserveAspectRatio="none" aria-hidden="true">
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function CircularProgressRing({ used, limit }: { used: number; limit: number }) {
  const percentage = Math.min(100, Math.max(0, limit > 0 ? (used / limit) * 100 : 0));
  const radius = 20;
  const stroke = 3;
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-10 h-10 shrink-0">
      <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
        <circle
          stroke="rgba(255, 255, 255, 0.05)"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke="rgb(16, 185, 129)" // emerald-500
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          className="transition-all duration-500 ease-in-out"
        />
      </svg>
      <span className="absolute text-[8px] font-bold text-emerald-400">
        {Math.round(percentage)}%
      </span>
    </div>
  );
}

function MetricCard({ title, value, icon, trend, loading, footer, sparklineData, sparklineColor, progressRing }: MetricCardProps) {
  if (loading) {
    return (
      <Card className="bg-muted/10 border-border/50 backdrop-blur-md">
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
    <Card className="bg-muted/10 border-border/50 backdrop-blur-md transition-all duration-300 hover:hover:border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
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
          </div>
          {progressRing && (
            <CircularProgressRing used={progressRing.used} limit={progressRing.limit} />
          )}
        </div>
        {sparklineData && sparklineData.length > 1 && (
          <Sparkline data={sparklineData} color={sparklineColor} />
        )}
      </CardContent>
    </Card>
  );
}

export function MetricsCards({ metrics, period, loading, error, onRetry, userTier }: MetricsCardsProps) {
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
