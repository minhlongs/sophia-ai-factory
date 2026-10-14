'use client';

// i18n-namespace: sop.detail_page.analytics

/**
 * SOP Analytics Breakdown and KPI Summary
 *
 * Layer: components/sop/detail/analytics
 */

import React from 'react';
import type { SopStats } from './types';

export interface AnalyticsCardsProps {
  stats: SopStats;
  totalCreditsSpent?: number;
  creditsPerRun: number;
  runsLast24hCount: number;
  t: (key: string) => string;
}

export function AnalyticsCards({
  stats,
  totalCreditsSpent,
  creditsPerRun,
  runsLast24hCount,
  t,
}: AnalyticsCardsProps) {
  return (
    <>
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
          <div className="mt-1 text-2xl font-semibold text-foreground">{totalCreditsSpent ?? stats.total * creditsPerRun}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-sm text-muted-foreground">{t('runsLast24h')}</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">
            {runsLast24hCount}
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
            <div className="bg-blue-500 transition-all" style={{ width: `${(stats.running / stats.total) * 100}%` }} title={`Running: ${stats.running}`} />
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
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> {t('statusRunning')}: {stats.running}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-500" /> {t('statusPaused')}: {stats.paused}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> {t('statusFailed')}: {stats.failed}</span>
        </div>
      </div>
    </>
  );
}
