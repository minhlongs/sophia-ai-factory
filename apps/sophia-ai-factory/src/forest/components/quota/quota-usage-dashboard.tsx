/**
 * Quota Usage Dashboard Component
 * Composition root: real-time quota gauges, overage events, upgrade prompts
 */

'use client';

import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { QuotaWarningBanner } from './quota-warning-banner';
import { QuotaOverageEventsList } from './quota-overage-events-list';

interface QuotaStatus {
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

interface OverageEvent {
  id: string;
  exceededType: string;
  exceededLimit: number;
  exceededCurrent: number;
  exceededBy: number;
  tierAtExceeded: string;
  createdAt: number;
  billable: boolean;
}

interface OveragesSummary {
  totalOverageEvents: number;
  totalOverageCredits: number;
  byType: Record<string, number>;
  billableEvents: number;
}

interface QuotaStatusResponse {
  quota?: QuotaStatus;
}

interface OverageEventsResponse {
  events?: OverageEvent[];
  summary?: OveragesSummary;
}

/** Inline quota gauge — small enough to stay in root file */
function QuotaGauge({
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
        <span className="text-muted-foreground">{used.toLocaleString()} used</span>
        <span className="text-muted-foreground">{limit.toLocaleString()} limit</span>
        <span className={`font-medium ${isCritical ? 'text-red-500' : isWarning ? 'text-amber-500' : ''}`}>
          {percentage.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

export function QuotaUsageDashboard() {
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [overageEvents, setOverageEvents] = useState<OverageEvent[]>([]);
  const [summary, setSummary] = useState<OveragesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [quotaRes, overageRes] = await Promise.all([
          fetch('/api/quota/status'),
          fetch('/api/quota/overage-events'),
        ]);

        if (!quotaRes.ok) throw new Error('Failed to fetch quota status');
        if (!overageRes.ok) throw new Error('Failed to fetch overage events');

        const quotaData = (await quotaRes.json()) as QuotaStatusResponse;
        const overageData = (await overageRes.json()) as OverageEventsResponse;

        setQuotaStatus(quotaData.quota ?? null);
        setOverageEvents(overageData.events ?? []);
        setSummary(overageData.summary ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        <span className="ml-3 text-muted-foreground">Loading quota data...</span>
      </div>
    );
  }

  if (error || !quotaStatus) {
    return (
      <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <div>
            <h3 className="font-semibold text-red-500">Error Loading Quota Data</h3>
            <p className="text-sm text-muted-foreground">{error || 'Unknown error'}</p>
          </div>
        </div>
      </div>
    );
  }

  const maxUsage = Math.max(
    quotaStatus.percentages.hourly,
    quotaStatus.percentages.daily,
    quotaStatus.percentages.monthly
  );

  return (
    <div className="space-y-6">
      <QuotaWarningBanner maxUsage={maxUsage} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuotaGauge
          title="Hourly Credits"
          used={quotaStatus.usage.hourly}
          limit={quotaStatus.limits.hourlyCredits}
          percentage={quotaStatus.percentages.hourly}
        />
        <QuotaGauge
          title="Daily Credits"
          used={quotaStatus.usage.daily}
          limit={quotaStatus.limits.dailyCredits}
          percentage={quotaStatus.percentages.daily}
        />
        <QuotaGauge
          title="Monthly Credits"
          used={quotaStatus.usage.monthly}
          limit={quotaStatus.limits.monthlyCredits}
          percentage={quotaStatus.percentages.monthly}
        />
      </div>

      <QuotaOverageEventsList overageEvents={overageEvents} summary={summary} />
    </div>
  );
}
