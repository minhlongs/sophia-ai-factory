/**
 * Quota Usage Gauge Component
 *
 * Displays usage vs limits with warning thresholds
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface QuotaUsage {
  hourly: number;
  daily: number;
  monthly: number;
  requests: number;
}

interface QuotaLimits {
  hourlyCredits: number;
  dailyCredits: number;
  monthlyCredits: number;
  dailyRequests: number;
}

interface QuotaUsageGaugeProps {
  usage: QuotaUsage;
  limits: QuotaLimits;
  status?: 'ok' | 'warning' | 'critical';
  overageAllowed?: boolean;
}

export function QuotaUsageGauge({
  usage,
  limits,
  status = 'ok',
  overageAllowed = false,
}: QuotaUsageGaugeProps) {
  const calculatePercentage = (current: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusIcon = (percentage: number) => {
    if (percentage >= 100) return '🔴';
    if (percentage >= 80) return '🟡';
    return '🟢';
  };

  const renderGauge = (
    label: string,
    current: number,
    limit: number,
    suffix = 'credits'
  ) => {
    const percentage = calculatePercentage(current, limit);
    const color = getProgressColor(percentage);
    const icon = getStatusIcon(percentage);

    return (
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">
            {icon} {label}
          </span>
          <span className="text-sm text-muted-foreground">
            {current.toLocaleString()} / {limit.toLocaleString()} {suffix}
          </span>
        </div>
        <Progress
          value={percentage}
          className={`h-2 ${color}`}
          indicatorClassName={color}
        />
        {percentage >= 80 && (
          <p className="text-xs text-orange-600">
            {percentage >= 100
              ? 'Limit exceeded!'
              : `${Math.round(100 - percentage)}% remaining before limit`}
          </p>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Quota Usage</span>
          {overageAllowed && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
              Overage Billing Enabled
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Current period usage vs your {limits.dailyCredits.toLocaleString()} credit limit
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderGauge('Hourly', usage.hourly, limits.hourlyCredits)}
        {renderGauge('Daily', usage.daily, limits.dailyCredits)}
        {renderGauge('Monthly', usage.monthly, limits.monthlyCredits)}

        {/* Overall Status */}
        <div className="border-t pt-4 mt-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Overall Status:</span>
            <span
              className={`text-sm font-semibold ${
                status === 'critical'
                  ? 'text-red-600'
                  : status === 'warning'
                  ? 'text-yellow-600'
                  : 'text-green-600'
              }`}
            >
              {status === 'critical'
                ? 'Critical - Limit Exceeded'
                : status === 'warning'
                ? 'Warning - Approaching Limit'
                : 'Good - Within Limits'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
