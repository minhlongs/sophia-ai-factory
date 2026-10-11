'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Skeleton } from '@/seed/components/ui/skeleton';
import type { MetricCardProps } from './types';
import { TrendBadge, Sparkline, CircularProgressRing } from './trend-badge';

export function MetricCard({
  title,
  value,
  icon,
  trend,
  loading,
  footer,
  sparklineData,
  sparklineColor,
  progressRing,
}: MetricCardProps) {
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
              {trend !== undefined && <TrendBadge trend={trend} />}
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
