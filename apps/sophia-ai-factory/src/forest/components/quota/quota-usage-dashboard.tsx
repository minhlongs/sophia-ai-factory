/**
 * Quota Usage Dashboard Component
 * Composition root: real-time quota gauges, overage events, upgrade prompts
 */

'use client';

import { useEffect, useState } from 'react';
import { QuotaWarningBanner } from './quota-warning-banner';
import { QuotaOverageEventsList } from './quota-overage-events-list';
import {
  QuotaGauge,
  QuotaLoadingState,
  QuotaErrorState,
  type QuotaStatus,
  type OverageEvent,
  type OveragesSummary,
  type QuotaStatusResponse,
  type OverageEventsResponse,
} from './quota-usage-cards';

export {
  QuotaGauge,
  QuotaLoadingState,
  QuotaErrorState,
  type QuotaStatus,
  type OverageEvent,
  type OveragesSummary,
  type QuotaStatusResponse,
  type OverageEventsResponse,
};

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
    return <QuotaLoadingState />;
  }

  if (error || !quotaStatus) {
    return <QuotaErrorState error={error} />;
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
