'use client';

/**
 * Quota Overage Events List
 * Summary stats + recent overage events table + empty state
 */

import { AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';

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

interface QuotaOverageEventsListProps {
  overageEvents: OverageEvent[];
  summary: OveragesSummary | null;
}

export function QuotaOverageEventsList({ overageEvents, summary }: QuotaOverageEventsListProps) {
  return (
    <>
      {/* Overage Summary */}
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

      {/* Recent Events */}
      {overageEvents.length > 0 ? (
        <div className="rounded-lg border">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Recent Overage Events</h3>
          </div>
          <div className="divide-y">
            {overageEvents.slice(0, 5).map((event) => (
              <div key={event.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle
                    className={`w-5 h-5 ${event.billable ? 'text-red-500' : 'text-amber-500'}`}
                  />
                  <div>
                    <p className="font-medium">
                      {event.exceededType.replace('_', ' ').toUpperCase()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {event.exceededCurrent} / {event.exceededLimit} credits
                      {event.exceededBy > 0 && (
                        <span className="text-red-500 ml-2">(+{event.exceededBy} over)</span>
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
      ) : (
        <div className="rounded-lg border p-4 text-center">
          <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="font-medium">No overage events</p>
          <p className="text-sm text-muted-foreground">Your usage is within quota limits</p>
        </div>
      )}
    </>
  );
}
