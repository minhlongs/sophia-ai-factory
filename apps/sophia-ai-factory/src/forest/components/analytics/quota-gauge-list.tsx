'use client';

/**
 * QuotaGaugeList Component
 *
 * Displays multiple gauges for different quota types
 */

import { QuotaGauge } from './QuotaGauge';

export interface QuotaData {
  label: string;
  used: number;
  limit: number;
}

export interface QuotaGaugeListProps {
  quotas: QuotaData[];
  columns?: 2 | 3 | 4;
}

export function QuotaGaugeList({ quotas, columns = 3 }: QuotaGaugeListProps) {
  return (
    <div
      className={`grid gap-6 ${
        columns === 2
          ? 'grid-cols-1 sm:grid-cols-2'
          : columns === 3
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      }`}
    >
      {quotas.map((quota, index) => (
        <div
          key={index}
          className="bg-card rounded-lg border border-border p-4"
        >
          <QuotaGauge
            usedCredits={quota.used}
            limitCredits={quota.limit}
            label={quota.label}
            size={140}
            showPercentage={true}
          />
        </div>
      ))}
    </div>
  );
}
