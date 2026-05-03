'use client';

/**
 * ChurnTimeline — Line chart showing churned vs downgraded counts over time.
 *
 * Data source: GET /api/analytics/cohorts?metric=churn
 * Two series: "Churned" (cancellations) and "Downgraded"
 */

import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Skeleton } from '@/seed/components/ui/skeleton';
import type { ChurnTimeline as ChurnTimelineData } from '@/seed/types/analytics-cohort';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ChurnTimelineProps {
  /** Lookback months (1–12, default 3) */
  months?: number;
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded shadow-md px-3 py-2 text-xs">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChurnTimeline({ months = 3 }: ChurnTimelineProps) {
  const [data, setData] = useState<ChurnTimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/analytics/cohorts?metric=churn&months=${months}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as ChurnTimelineData;
        setData(json);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) {
          setError(e instanceof Error ? e.message : 'Failed to load');
        }
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [months]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Churn Timeline</CardTitle>
        {data && (
          <p className="text-xs text-gray-500">
            Avg monthly churn rate: {data.avgMonthlyChurnRate}%
          </p>
        )}
      </CardHeader>
      <CardContent>
        {loading && <Skeleton className="h-48 w-full" />}

        {error && (
          <p className="text-sm text-red-500">Failed to load churn data: {error}</p>
        )}

        {data && !loading && data.points.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No churn events in this period</p>
        )}

        {data && !loading && data.points.length > 0 && (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.points} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={d => d.slice(5)} // MM-DD
              />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="churnedCount"
                name="Churned"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="downgradedCount"
                name="Downgraded"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
