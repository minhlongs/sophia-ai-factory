/**
 * Usage Meter Component
 * Composition root: real-time quota utilization with progress meters
 *
 * @module components/license/usage-meter
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/seed/components/ui/card';
import { Progress } from '@/seed/components/ui/progress';
import { TrendingUp, AlertCircle } from 'lucide-react';
import { UsageMeterMetersList } from './usage-meter-meters-list';
import { UsageMeterRateLimitSection } from './usage-meter-rate-limit-section';
import { type UsageMeterData, getStatusColor, formatNumber } from './usage-meter-helpers';

interface UsageMeterProps {
  licenseNonce?: string;
  compact?: boolean;
  showRateLimit?: boolean;
}

export function UsageMeter({ licenseNonce, compact = false, showRateLimit = true }: UsageMeterProps) {
  const { data: usage, isLoading, error } = useQuery<UsageMeterData>({
    queryKey: ['/api/license/usage', licenseNonce],
    enabled: !!licenseNonce,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="motion-safe:animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-3 bg-muted rounded w-1/4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="motion-safe:animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !usage) {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Usage Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Failed to load usage data. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  const meters = [
    { label: 'Hourly', data: usage.hourly },
    { label: 'Daily', data: usage.daily },
    { label: 'Monthly', data: usage.monthly },
  ];

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {meters.map((meter) => (
              <div key={meter.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{meter.label}</span>
                  <span className="font-medium">
                    {formatNumber(meter.data.used)} / {formatNumber(meter.data.limit)}
                  </span>
                </div>
                <Progress
                  value={meter.data.percentage}
                  indicatorClassName={getStatusColor(meter.data.status)}
                  className="h-2"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Usage Meters
            </CardTitle>
            <CardDescription>Real-time quota utilization</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <UsageMeterMetersList
          hourly={usage.hourly}
          daily={usage.daily}
          monthly={usage.monthly}
        />

        {showRateLimit && (
          <UsageMeterRateLimitSection rateLimit={usage.rateLimit} />
        )}
      </CardContent>
    </Card>
  );
}

export default UsageMeter;
