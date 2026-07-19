'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { SopRunRow, SopTemplateRow } from '@/tree/sop/sop-types';

interface SopAnalyticsTabProps {
  runs: SopRunRow[];
  totalRuns?: number;
  totalCreditsSpent?: number;
  sopId?: string;
  template?: SopTemplateRow | null;
}

interface DrillDownPanelProps {
  drillDownDate: string | null;
  setDrillDownDate: (v: string | null) => void;
  dayDrillDown: SopRunRow[] | null;
}

function DrillDownPanel({ drillDownDate, setDrillDownDate, dayDrillDown }: DrillDownPanelProps) {
  if (!drillDownDate || !dayDrillDown) return null;

  return (
    <div className="mt-3 rounded-md border border-border bg-muted p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">
          {dayDrillDown[0]
            ? new Date(dayDrillDown[0].created_at! * 1000).toLocaleDateString(
                undefined,
                { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
              )
            : drillDownDate}
        </h4>
        <button
          type="button"
          onClick={() => setDrillDownDate(null)}
          className="text-xs text-foreground hover:text-foreground underline"
        >
          Close
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-border text-muted-foreground">
              <th className="pb-1 pr-3 font-medium">Run ID</th>
              <th className="pb-1 pr-3 font-medium">Status</th>
              <th className="pb-1 pr-3 font-medium">Trigger</th>
              <th className="pb-1 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {dayDrillDown.map((run) => (
              <tr key={run.id} className="border-border">
                <td className="py-1.5 pr-3 font-mono text-foreground">
                  {run.id.slice(0, 12)}
                </td>
                <td className="py-1.5 pr-3">
                  <span
                    className={`
                      inline-flex rounded-full px-2 py-0.5
                      text-[10px] font-medium
                      ${run.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-700'
                        : run.status === 'running'
                        ? 'bg-primary/10 text-primary'
                        : run.status === 'paused'
                        ? 'bg-amber-100 text-amber-700'
                        : run.status === 'failed'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-muted text-muted-foreground'}
                    `}
                  >
                    {run.status}
                  </span>
                </td>
                <td className="py-1.5 pr-3 text-muted-foreground">
                  {run.trigger_type}
                </td>
                <td className="py-1.5 text-muted-foreground">
                  {run.created_at
                    ? new Date(run.created_at * 1000).toLocaleString()
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {dayDrillDown.length === 0 && (
          <p className="py-2 text-xs text-muted-foreground">
            No runs found for this day.
          </p>
        )}
      </div>
    </div>
  );
}

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

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">{t('totalRuns')}</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">{stats.total}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">{t('successRate')}</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-600">{stats.successRate}%</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">{t('creditsSpent')}</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">{totalCreditsSpent ?? runs.length * creditsPerRun}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">{t('runsLast24h')}</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">
            {runs.filter((r) => r.created_at && r.created_at > Math.floor(Date.now() / 1000) - 86400).length}
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-medium text-foreground">
          {t('breakdownTitle')}
        </h3>
        <div className="flex h-4 overflow-hidden rounded-full bg-muted">
          {stats.completed > 0 && (
            <div className="bg-green-500 transition-all" style={{ width: `${(stats.completed / stats.total) * 100}%` }} title={`Completed: ${stats.completed}`} />
          )}
          {stats.running > 0 && (
            <div className="bg-primary transition-all" style={{ width: `${(stats.running / stats.total) * 100}%` }} title={`Running: ${stats.running}`} />
          )}
          {stats.paused > 0 && (
            <div className="bg-yellow-500 transition-all" style={{ width: `${(stats.paused / stats.total) * 100}%` }} title={`Paused: ${stats.paused}`} />
          )}
          {stats.failed > 0 && (
            <div className="bg-red-500 transition-all" style={{ width: `${(stats.failed / stats.total) * 100}%` }} title={`Failed: ${stats.failed}`} />
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> {t('statusCompleted')}: {stats.completed}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> {t('statusRunning')}: {stats.running}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-500" /> {t('statusPaused')}: {stats.paused}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> {t('statusFailed')}: {stats.failed}</span>
        </div>
      </div>

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
