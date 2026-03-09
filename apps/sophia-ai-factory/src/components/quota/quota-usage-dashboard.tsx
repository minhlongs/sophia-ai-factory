/**
 * Quota Usage Dashboard Component
 *
 * Displays:
 * - Real-time quota usage gauges
 * - Overage events list
 * - Projected billing impact
 * - Upgrade prompts when approaching limits
 */

'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';

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

        const quotaData = await quotaRes.json();
        const overageData = await overageRes.json();

        setQuotaStatus(quotaData.quota);
        setOverageEvents(overageData.events);
        setSummary(overageData.summary);
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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

  const isCritical = maxUsage >= 100;
  const isWarning = maxUsage >= 80 && maxUsage < 100;

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      {(isWarning || isCritical) && (
        <div
          className={`rounded-lg border p-4 ${
            isCritical
              ? 'bg-red-500/10 border-red-500/50'
              : 'bg-amber-500/10 border-amber-500/50'
          }`}
        >
          <div className="flex items-center gap-3">
            {isCritical ? (
              <AlertTriangle className="w-5 h-5 text-red-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-500" />
            )}
            <div className="flex-1">
              <h3
                className={`font-semibold ${
                  isCritical ? 'text-red-500' : 'text-amber-500'
                }`}
              >
                {isCritical ? 'Quota Exceeded' : 'Quota Warning'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isCritical
                  ? "You've reached your usage limit. Upgrade to continue."
                  : `You've used ${maxUsage.toFixed(0)}% of your quota. Consider upgrading.`}
              </p>
            </div>
            <a
              href="/dashboard/billing"
              className={`px-4 py-2 rounded-md font-medium text-white ${
                isCritical ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'
              }`}
            >
              {isCritical ? 'Upgrade Now' : 'View Plans'}
            </a>
          </div>
        </div>
      )}

      {/* Quota Gauges */}
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

      {/* Overage Events Summary */}
      {summary && summary.totalOverageEvents > 0 && (
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Overage Summary (Today)
            </h3>
            <span className="text-sm text-muted-foreground">
              {summary.totalOverageEvents} events
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Overage Credits</p>
              <p className="text-2xl font-bold">{summary.totalOverageCredits}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Billable Events</p>
              <p className="text-2xl font-bold">{summary.billableEvents}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Hourly Overages</p>
              <p className="text-2xl font-bold">{summary.byType.hourly_credits || 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Daily Overages</p>
              <p className="text-2xl font-bold">{summary.byType.daily_credits || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Overage Events */}
      {overageEvents.length > 0 && (
        <div className="rounded-lg border">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Recent Overage Events</h3>
          </div>
          <div className="divide-y">
            {overageEvents.slice(0, 5).map((event) => (
              <div key={event.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle
                    className={`w-5 h-5 ${
                      event.billable ? 'text-red-500' : 'text-amber-500'
                    }`}
                  />
                  <div>
                    <p className="font-medium">
                      {event.exceededType.replace('_', ' ').toUpperCase()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {event.exceededCurrent} / {event.exceededLimit} credits
                      {event.exceededBy > 0 && (
                        <span className="text-red-500 ml-2">
                          (+{event.exceededBy} over)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    {new Date(event.createdAt * 1000).toLocaleString()}
                  </p>
                  {event.billable && (
                    <span className="text-xs bg-red-500/20 text-red-500 px-2 py-1 rounded">
                      Billable
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No overages message */}
      {overageEvents.length === 0 && (
        <div className="rounded-lg border p-4 text-center">
          <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="font-medium">No overage events</p>
          <p className="text-sm text-muted-foreground">
            Your usage is within quota limits
          </p>
        </div>
      )}
    </div>
  );
}

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
        <span className="text-muted-foreground">
          {used.toLocaleString()} used
        </span>
        <span className="text-muted-foreground">
          {limit.toLocaleString()} limit
        </span>
        <span
          className={`font-medium ${
            isCritical ? 'text-red-500' : isWarning ? 'text-amber-500' : ''
          }`}
        >
          {percentage.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
