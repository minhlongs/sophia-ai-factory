'use client';

/**
 * CohortRetentionChart — Heatmap grid showing retention % per cohort month.
 *
 * Data source: GET /api/analytics/cohorts?metric=retention
 * Rows = cohort months, Columns = month offsets (M0, M1, M2, …)
 * Color intensity = retention % (green scale)
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/seed/components/ui/card';
import { Skeleton } from '@/seed/components/ui/skeleton';
import type { CohortRetentionMatrix } from '@/seed/types/analytics-cohort';
import { CohortRetentionTable } from './cohort-retention-table';

export interface CohortRetentionChartProps {
  /** Months to display (default 12) */
  months?: number;
}

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
          <CohortRetentionTable cohorts={data.cohorts} colHeaders={colHeaders} />
        )}
      </CardContent>
    </Card>
  );
}
