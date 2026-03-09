/**
 * Usage Meter Component
 *
 * Displays real-time usage quotas with visual meters:
 * - Hourly/Daily/Monthly usage breakdown
 * - Percentage indicators with color coding
 * - Overage tracking
 * - Rate limit status
 *
 * Features:
 * - Auto-refresh every 30 seconds
 * - Color-coded thresholds (green < 80%, yellow 80-90%, red > 90%)
 * - Overage amount display
 * - Tooltip with detailed info
 *
 * @module components/license/usage-meter
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Zap, Clock, Calendar, TrendingUp, AlertCircle } from 'lucide-react';

interface UsageMeterData {
  hourly: {
    used: number;
    limit: number;
    percentage: number;
    status: 'ok' | 'warning' | 'critical' | 'overage';
  };
  daily: {
    used: number;
    limit: number;
    percentage: number;
    status: 'ok' | 'warning' | 'critical' | 'overage';
  };
  monthly: {
    used: number;
    limit: number;
    percentage: number;
    status: 'ok' | 'warning' | 'critical' | 'overage';
    overage?: number;
  };
  rateLimit: {
    current: number;
    limit: number;
    remaining: number;
    resetAt: string;
  };
}

interface UsageMeterProps {
  licenseNonce?: string;
  compact?: boolean;
  showRateLimit?: boolean;
}

/**
 * Get status color for usage meter
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'overage': return 'bg-destructive';
    case 'critical': return 'bg-orange-500';
    case 'warning': return 'bg-yellow-500';
    default: return 'bg-green-500';
  }
}

/**
 * Get status border color
 */
function getStatusBorderColor(status: string): string {
  switch (status) {
    case 'overage': return 'border-destructive';
    case 'critical': return 'border-orange-500';
    case 'warning': return 'border-yellow-500';
    default: return 'border-green-500';
  }
}

/**
 * Format number with K/M suffix
 */
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

/**
 * Usage Meter Component
 */
export function UsageMeter({ licenseNonce, compact = false, showRateLimit = true }: UsageMeterProps) {
  // Fetch usage data
  const { data: usage, isLoading, error } = useQuery<UsageMeterData>({
    queryKey: ['/api/license/usage', licenseNonce],
    enabled: !!licenseNonce,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-3 bg-muted rounded w-1/4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
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
    {
      label: 'Hourly',
      icon: Clock,
      data: usage.hourly,
      description: 'Credits used this hour',
    },
    {
      label: 'Daily',
      icon: Zap,
      data: usage.daily,
      description: 'Credits used today',
    },
    {
      label: 'Monthly',
      icon: Calendar,
      data: usage.monthly,
      description: 'Credits used this month',
    },
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
            <CardDescription>
              Real-time quota utilization
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Usage Meters */}
        <div className="space-y-4">
          {meters.map((meter) => {
            const Icon = meter.icon;
            return (
              <div
                key={meter.label}
                className={`space-y-2 p-4 rounded-lg border ${getStatusBorderColor(meter.data.status)} bg-muted/30`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{meter.label} Usage</span>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge
                          variant={
                            meter.data.status === 'overage' ? 'destructive' :
                            meter.data.status === 'critical' ? 'default' :
                            meter.data.status === 'warning' ? 'secondary' : 'outline'
                          }
                        >
                          {meter.data.status.toUpperCase()}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{meter.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <div className="space-y-2">
                  <Progress
                    value={meter.data.percentage}
                    indicatorClassName={getStatusColor(meter.data.status)}
                    className="h-3"
                  />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {formatNumber(meter.data.used)} used
                    </span>
                    <span className="font-medium">
                      {formatNumber(meter.data.limit)} limit
                    </span>
                    <span className="text-muted-foreground">
                      {meter.data.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {meter.data.status === 'overage' && meter.data.overage && (
                  <div className="flex items-center gap-2 text-xs text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    {formatNumber(meter.data.overage)} credits over limit
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Rate Limit Status */}
        {showRateLimit && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Rate Limit</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{usage.rateLimit.current}</div>
                <div className="text-xs text-muted-foreground">Current RPM</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{usage.rateLimit.limit}</div>
                <div className="text-xs text-muted-foreground">Max RPM</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{usage.rateLimit.remaining}</div>
                <div className="text-xs text-muted-foreground">Remaining</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground text-center">
              Rate limit resets at {new Date(usage.rateLimit.resetAt).toLocaleTimeString()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default UsageMeter;
