/**
 * Quota Usage Dashboard Cards & Types
 *
 * Extracted from quota-usage-dashboard.tsx: QuotaStatus types, QuotaGauge card,
 * loading state, and error state subcomponents.
 */

'use client';

import { AlertCircle } from 'lucide-react';

export interface QuotaStatus {
  usage: { hourly: number; daily: number; monthly: number; requests: number };
  limits: {
    tier: string;
    dailyCredits: number;
    hourlyCredits: number;
    monthlyCredits: number;
    dailyRequests: number;
  };
  percentages: { hourly: number; daily: number; monthly: number };
  status: 'ok' | 'warning' | 'critical';
}

export interface OverageEvent {
  id: string;
  exceededType: string;
  exceededLimit: number;
  exceededCurrent: number;
  exceededBy: number;
  tierAtExceeded: string;
  createdAt: number;
  billable: boolean;
}

export interface OveragesSummary {
  totalOverageEvents: number;
  totalOverageCredits: number;
  byType: Record<string, number>;
  billableEvents: number;
}

export interface QuotaStatusResponse {
  quota?: QuotaStatus;
}

export interface OverageEventsResponse {
  events?: OverageEvent[];
  summary?: OveragesSummary;
}

export function QuotaGauge({
  title,
  used,
  limit,
  percentage,
}: {
  title: string;
  used: number;
  limit: number;
  percentage: number;
}) {
  const isCritical = percentage >= 100;
  const isWarning = percentage >= 80 && percentage < 100;
  const color = isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-green-500';

  return (
    <div className="rounded-lg border p-4">
      <h4 className="font-medium mb-2">{title}</h4>
      <div className="relative h-4 bg-muted rounded-full overflow-hidden mb-2">
        <div
          className={`absolute top-0 left-0 h-full ${color} transition-all duration-300`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground tabular-nums">{used.toLocaleString()} used</span>
        <span className="text-muted-foreground tabular-nums">{limit.toLocaleString()} limit</span>
        <span className={`font-medium tabular-nums ${isCritical ? 'text-red-500' : isWarning ? 'text-amber-500' : ''}`}>
          {percentage.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

export function QuotaLoadingState() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="motion-safe:animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      <span className="ml-3 text-muted-foreground">Loading quota data...</span>
    </div>
  );
}

export function QuotaErrorState({ error }: { error: string | null }) {
  return (
    <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
      <div className="flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-500" aria-hidden="true" />
        <div>
          <h3 className="font-semibold text-red-500">Error Loading Quota Data</h3>
          <p className="text-sm text-muted-foreground">{error || 'Unknown error'}</p>
        </div>
      </div>
    </div>
  );
}
