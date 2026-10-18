/**
 * Quota Usage Gauge Component
 *
 * Displays usage vs limits with warning thresholds
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { QuotaGaugeRow } from './quota-gauge-row';

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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Quota Usage</span>
          {overageAllowed && (
            <span className="text-xs bg-blue-900/30 text-blue-300 px-2 py-1 rounded">
              Overage Billing Enabled
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Current period usage vs your {limits.dailyCredits.toLocaleString()} credit limit
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <QuotaGaugeRow label="Hourly" current={usage.hourly} limit={limits.hourlyCredits} />
        <QuotaGaugeRow label="Daily" current={usage.daily} limit={limits.dailyCredits} />
        <QuotaGaugeRow label="Monthly" current={usage.monthly} limit={limits.monthlyCredits} />

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
