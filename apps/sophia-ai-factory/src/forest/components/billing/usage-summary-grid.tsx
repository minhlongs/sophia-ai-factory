/**
 * Status color helpers and FullUsageSummary grid for UsageSummaryCard.
 * @module forest/components/billing/usage-summary-grid
 */

'use client';

import { UsageSummaryCard } from './usage-summary-card';

export type UsageStatus = 'ok' | 'warning' | 'critical' | 'overage';

export const PERIOD_LABELS: Record<'hourly' | 'daily' | 'monthly', string> = {
  hourly: 'This hour',
  daily: 'Today',
  monthly: 'This month',
};

export const getStatusColor = (status: string) => {
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

export const getProgressColor = (status: string) => {
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

export interface FullUsageSummaryProps {
  hourly: { used: number; limit: number; percentage: number; status: UsageStatus };
  daily: { used: number; limit: number; percentage: number; status: UsageStatus };
  monthly: { used: number; limit: number; percentage: number; status: UsageStatus; overage?: number };
}

export function FullUsageSummary({ hourly, daily, monthly }: FullUsageSummaryProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <UsageSummaryCard
        title="Hourly Usage"
        used={hourly.used}
        limit={hourly.limit}
        percentage={hourly.percentage}
        status={hourly.status}
        period="hourly"
      />
      <UsageSummaryCard
        title="Daily Usage"
        used={daily.used}
        limit={daily.limit}
        percentage={daily.percentage}
        status={daily.status}
        period="daily"
      />
      <UsageSummaryCard
        title="Monthly Usage"
        used={monthly.used}
        limit={monthly.limit}
        percentage={monthly.percentage}
        status={monthly.status}
        period="monthly"
        overage={monthly.overage}
      />
    </div>
  );
}
