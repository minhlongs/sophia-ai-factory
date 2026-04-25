'use client';

/**
 * CohortRetentionChart — Heatmap grid showing retention % per cohort month.
 *
 * Data source: GET /api/analytics/cohorts?metric=retention
 * Rows = cohort months, Columns = month offsets (M0, M1, M2, …)
 * Color intensity = retention % (green scale)
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { CohortRetentionMatrix, CohortRow } from '@/types/analytics-cohort';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Map a retention percentage (0–100) to a Tailwind bg class */
function retentionColor(pct: number): string {
  if (pct >= 90) return 'bg-green-700 text-white';
  if (pct >= 75) return 'bg-green-500 text-white';
  if (pct >= 60) return 'bg-green-400 text-gray-900';
  if (pct >= 40) return 'bg-green-300 text-gray-900';
  if (pct >= 20) return 'bg-green-200 text-gray-900';
  if (pct > 0)   return 'bg-green-100 text-gray-700';
  return 'bg-gray-100 text-gray-400';
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CohortRetentionChartProps {
  /** Months to display (default 12) */
  months?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CohortRetentionChart({ months = 12 }: CohortRetentionChartProps) {
  const [data, setData] = useState<CohortRetentionMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/analytics/cohorts?metric=retention&months=${months}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as CohortRetentionMatrix;
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

  const maxCols = data?.monthsTracked ?? months;
  const colHeaders = Array.from({ length: maxCols + 1 }, (_, i) => `M${i}`);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Cohort Retention</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-500">Failed to load retention data: {error}</p>
        )}

        {data && !loading && (
          <div className="overflow-x-auto">
            <table className="text-xs border-separate border-spacing-0.5 min-w-max">
              <thead>
                <tr>
                  <th className="text-left pr-2 font-medium text-gray-600 whitespace-nowrap">
                    Cohort
                  </th>
                  <th className="px-1 font-medium text-gray-600">Users</th>
                  {colHeaders.map(col => (
                    <th key={col} className="px-1 font-medium text-gray-600 min-w-[3rem]">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.cohorts.map((row: CohortRow) => (
                  <tr key={row.cohortMonth}>
                    <td className="pr-2 text-gray-700 font-medium whitespace-nowrap">
                      {row.cohortMonth}
                    </td>
                    <td className="px-1 text-center text-gray-600">
                      {row.usersAtStart}
                    </td>
                    {row.retentionByMonth.map((pct, idx) => (
                      <td
                        key={idx}
                        className={`px-1 text-center rounded ${retentionColor(pct)}`}
                        title={`${row.cohortMonth} — Month ${idx}: ${pct}%`}
                      >
                        {pct > 0 ? `${pct}%` : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
                {data.cohorts.length === 0 && (
                  <tr>
                    <td colSpan={colHeaders.length + 2} className="text-center text-gray-400 py-4">
                      No cohort data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
