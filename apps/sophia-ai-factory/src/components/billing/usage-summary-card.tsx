/**
 * Usage Summary Card Component
 *
 * Displays usage progress bars for hourly, daily, and monthly limits.
 * Shows overage warnings when limits are exceeded.
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/seed/components/ui/card';
import { Progress } from '@/seed/components/ui/progress';
import { Badge } from '@/seed/components/ui/badge';
import { Alert, AlertDescription } from '@/seed/components/ui/alert';
import { Zap, TrendingUp, Calendar, AlertTriangle } from 'lucide-react';

interface UsageSummaryCardProps {
  title: string;
  description?: string;
  used: number;
  limit: number;
  overage?: number;
  period?: 'hourly' | 'daily' | 'monthly';
  percentage?: number;
  status?: 'ok' | 'warning' | 'critical' | 'overage';
}

const PERIOD_LABELS: Record<'hourly' | 'daily' | 'monthly', string> = {
  hourly: 'This hour',
  daily: 'Today',
  monthly: 'This month',
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'overage':
      return 'text-red-600';
    case 'critical':
      return 'text-orange-600';
    case 'warning':
      return 'text-yellow-600';
    default:
      return 'text-green-600';
  }
};

const getProgressColor = (status: string) => {
  switch (status) {
    case 'overage':
    case 'critical':
      return 'bg-red-600';
    case 'warning':
      return 'bg-yellow-600';
    default:
      return 'bg-green-600';
  }
};

export function UsageSummaryCard({
  title,
  description,
  used,
  limit,
  overage,
  period = 'daily',
  percentage,
  status = 'ok',
}: UsageSummaryCardProps) {
  const calculatedPercentage = percentage ?? (used / limit) * 100;
  const displayPercentage = Math.min(calculatedPercentage, 100);
  const isOverage = overage !== undefined && overage > 0;

  const icon = {
    hourly: <Zap className="h-4 w-4" />,
    daily: <TrendingUp className="h-4 w-4" />,
    monthly: <Calendar className="h-4 w-4" />,
  }[period];

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
          </div>
          <Badge variant={isOverage ? 'destructive' : 'secondary'}>
            {isOverage ? 'Over Limit' : PERIOD_LABELS[period]}
          </Badge>
        </div>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress Bar */}
        <div className="space-y-1">
          <Progress
            value={displayPercentage}
            className={`h-2 ${isOverage ? 'bg-red-100' : ''}`}
            indicatorClassName={getProgressColor(status)}
          />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {used.toLocaleString()} used
            </span>
            <span className="text-muted-foreground">
              {limit.toLocaleString()} limit
            </span>
          </div>
        </div>

        {/* Usage Stats */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Usage</p>
            <p className={`text-lg font-bold ${getStatusColor(status)}`}>
              {calculatedPercentage.toFixed(1)}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p className="text-lg font-bold">
              {Math.max(0, limit - used).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Overage Warning */}
        {isOverage && (
          <Alert variant="destructive" className="mt-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>{overage!.toLocaleString()} credits over limit</strong>
              <span className="text-muted-foreground">
                {' '}
                - Overage charges may apply
              </span>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Usage Summary Grid - Renders all three period cards
 */
interface FullUsageSummaryProps {
  hourly: { used: number; limit: number; percentage: number; status: string };
  daily: { used: number; limit: number; percentage: number; status: string };
  monthly: { used: number; limit: number; percentage: number; status: string; overage?: number };
}

export function FullUsageSummary({ hourly, daily, monthly }: FullUsageSummaryProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <UsageSummaryCard
        title="Hourly Usage"
        used={hourly.used}
        limit={hourly.limit}
        percentage={hourly.percentage}
        status={hourly.status as any}
        period="hourly"
      />
      <UsageSummaryCard
        title="Daily Usage"
        used={daily.used}
        limit={daily.limit}
        percentage={daily.percentage}
        status={daily.status as any}
        period="daily"
      />
      <UsageSummaryCard
        title="Monthly Usage"
        used={monthly.used}
        limit={monthly.limit}
        percentage={monthly.percentage}
        status={monthly.status as any}
        period="monthly"
        overage={monthly.overage}
      />
    </div>
  );
}
