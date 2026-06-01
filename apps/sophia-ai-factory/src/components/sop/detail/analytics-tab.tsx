'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { SopRunRow } from '@/tree/sop/sop-types';

interface SopAnalyticsTabProps {
  runs: SopRunRow[];
  totalRuns?: number;
  totalCreditsSpent?: number;
}

export function SopAnalyticsTab({ runs, totalRuns, totalCreditsSpent }: SopAnalyticsTabProps) {
  const t = useTranslations('sop.detail_page.analytics');

  const stats = useMemo(() => {
    const completed = runs.filter((r) => r.status === 'completed').length;
    const failed = runs.filter((r) => r.status === 'failed').length;
    const paused = runs.filter((r) => r.status === 'paused').length;
    const running = runs.filter((r) => r.status === 'running').length;
    const total = totalRuns ?? runs.length;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, failed, paused, running, total, successRate };
  }, [runs, totalRuns]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-500">{t('totalRuns')}</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900">{stats.total}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-500">{t('successRate')}</div>
          <div className="mt-1 text-2xl font-semibold text-green-600">{stats.successRate}%</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-500">{t('creditsSpent')}</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900">{totalCreditsSpent ?? 0}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-500">{t('runsLast24h')}</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900">
            {runs.filter((r) => r.created_at && r.created_at > Math.floor(Date.now() / 1000) - 86400).length}
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-medium text-gray-700">
          {t('breakdownTitle')}
        </h3>
        <div className="flex h-4 overflow-hidden rounded-full bg-gray-100">
          {stats.completed > 0 && (
            <div className="bg-green-500 transition-all" style={{ width: `${(stats.completed / stats.total) * 100}%` }} title={`Completed: ${stats.completed}`} />
          )}
          {stats.running > 0 && (
            <div className="bg-blue-500 transition-all" style={{ width: `${(stats.running / stats.total) * 100}%` }} title={`Running: ${stats.running}`} />
          )}
          {stats.paused > 0 && (
            <div className="bg-yellow-500 transition-all" style={{ width: `${(stats.paused / stats.total) * 100}%` }} title={`Paused: ${stats.paused}`} />
          )}
          {stats.failed > 0 && (
            <div className="bg-red-500 transition-all" style={{ width: `${(stats.failed / stats.total) * 100}%` }} title={`Failed: ${stats.failed}`} />
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> {t('statusCompleted')}: {stats.completed}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> {t('statusRunning')}: {stats.running}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-500" /> {t('statusPaused')}: {stats.paused}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> {t('statusFailed')}: {stats.failed}</span>
        </div>
      </div>

      {/* Recent Runs Timeline */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-medium text-gray-700">
          {t('recentRuns')}
        </h3>
        {runs.length === 0 ? (
          <p className="text-sm text-gray-500">{t('runs.empty', { fallback: 'No runs yet.' })}</p>
        ) : (
          <div className="space-y-2">
            {runs.slice(0, 20).map((run) => (
              <div key={run.id} className="flex items-center justify-between rounded border border-gray-100 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${
                    run.status === 'completed' ? 'bg-green-500' :
                    run.status === 'running' ? 'bg-blue-500' :
                    run.status === 'paused' ? 'bg-yellow-500' :
                    run.status === 'failed' ? 'bg-red-500' :
                    'bg-gray-400'
                  }`} />
                  <span className="font-mono text-xs text-gray-600">{run.id.slice(0, 8)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{run.trigger_type}</span>
                  {run.created_at && <span>{new Date(run.created_at * 1000).toLocaleString()}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
