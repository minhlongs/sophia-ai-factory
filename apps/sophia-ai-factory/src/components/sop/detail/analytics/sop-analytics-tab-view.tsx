'use client';

/**
 * SOP Detail Analytics Main Tab Component
 *
 * Layer: components/sop/detail/analytics
 */

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { SopAnalyticsTabProps } from './types';
import { DrillDownPanel } from './drill-down-panel';
import { AnalyticsCards } from './analytics-cards';

export function SopAnalyticsTab({ runs, totalRuns, totalCreditsSpent, template }: SopAnalyticsTabProps) {
  const creditsPerRun = template?.credits_per_run ?? 1;
  const t = useTranslations('sop.detail_page.analytics');
  const [drillDownDate, setDrillDownDate] = useState<string | null>(null);

  const stats = useMemo(() => {
    const completed = runs.filter((r) => r.status === 'completed').length;
    const failed = runs.filter((r) => r.status === 'failed').length;
    const paused = runs.filter((r) => r.status === 'paused').length;
    const running = runs.filter((r) => r.status === 'running').length;
    const total = totalRuns ?? runs.length;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, failed, paused, running, total, successRate };
  }, [runs, totalRuns]);

  const dayDrillDown = useMemo(() => {
    if (!drillDownDate) return null;
    const startOfDay = new Date(drillDownDate).setHours(0, 0, 0, 0);
    const endOfDay = new Date(drillDownDate).setHours(23, 59, 59, 999);
    const startSec = Math.floor(startOfDay / 1000);
    const endSec = Math.floor(endOfDay / 1000);
    return runs.filter((r) => r.created_at && r.created_at >= startSec && r.created_at <= endSec);
  }, [drillDownDate, runs]);

  const runsLast24hCount = runs.filter(
    (r) => r.created_at && r.created_at > Math.floor(Date.now() / 1000) - 86400
  ).length;

  return (
    <div className="space-y-6">
      <AnalyticsCards
        stats={stats}
        totalCreditsSpent={totalCreditsSpent}
        creditsPerRun={creditsPerRun}
        runsLast24hCount={runsLast24hCount}
        t={t}
      />

      {/* Recent Runs Timeline with drill-down */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium text-foreground">
          {t('recentRuns')}
        </h3>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('runs.empty', { fallback: 'No runs yet.' })}</p>
        ) : (
          <div className="space-y-2">
            {runs.slice(0, 20).map((run) => {
              const dayLabel = run.created_at
                ? new Date(run.created_at * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                : '';
              return (
                <div
                  key={run.id}
                  onClick={() => dayLabel && setDrillDownDate(dayLabel)}
                  className={`
                    flex items-center justify-between
                    rounded border border-border px-3 py-2
                    ${dayLabel ? 'cursor-pointer hover:border-primary hover:bg-muted' : ''}
                  `}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`
                        inline-block h-2 w-2 rounded-full
                        ${run.status === 'completed'
                          ? 'bg-emerald-500'
                          : run.status === 'running'
                          ? 'bg-blue-500'
                          : run.status === 'paused'
                          ? 'bg-amber-500'
                          : run.status === 'failed'
                          ? 'bg-red-500'
                          : 'bg-muted'}
                      `}
                    />
                    <span className="font-mono text-xs text-muted-foreground">
                      {run.id.slice(0, 8)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{run.trigger_type}</span>
                    {run.created_at && (
                      <span>
                        {new Date(run.created_at * 1000).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <DrillDownPanel
              drillDownDate={drillDownDate}
              setDrillDownDate={setDrillDownDate}
              dayDrillDown={dayDrillDown}
            />
          </div>
        )}
      </div>
    </div>
  );
}
