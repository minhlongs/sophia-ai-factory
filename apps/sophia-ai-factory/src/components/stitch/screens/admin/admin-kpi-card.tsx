// i18n-namespace: stitch.admin
'use client';

/**
 * KPI metric card and deploy footer for AdminPageContent.
 * @module components/stitch/screens/admin/admin-kpi-card
 */

import React from 'react';
import { TrendingUp, TrendingDown, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/seed/utils/cn';
import { Card } from '@/seed/components/ui/card';
import type { KpiData, DeployStatus } from './admin-page-types';

export function AdminKpiCard({
  metric,
  t,
}: {
  metric: KpiData;
  t: (key: string) => string;
}) {
  return (
    <Card glass className="p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          {t(`kpi.${metric.id}.label`)}
        </span>
        {metric.trendDirection &&
          (metric.trendDirection === 'up' ? (
            <TrendingUp className="w-4 h-4 text-emerald-500" aria-hidden="true" />
          ) : (
            <TrendingDown className="w-4 h-4 text-error" aria-hidden="true" />
          ))}
        {metric.trendLabel && (
          <span className="text-xs text-on-surface-variant font-medium">{metric.trendLabel}</span>
        )}
      </div>
      <h3 className="text-2xl font-bold text-on-surface">{metric.value}</h3>
      {(metric.trend || metric.trendSub) && (
        <div className="flex items-center gap-2 mt-2">
          {metric.trend && (
            <span
              className={cn(
                'text-xs font-bold',
                metric.trendDirection === 'up' ? 'text-emerald-500' : 'text-error',
              )}
            >
              {metric.trend}
            </span>
          )}
          {metric.trendSub && (
            <span className="text-xs text-on-surface-variant">{metric.trendSub}</span>
          )}
        </div>
      )}
    </Card>
  );
}

export function AdminDeployFooter({
  deploy,
  t,
}: {
  deploy: DeployStatus;
  t: (key: string) => string;
}) {
  return (
    <div className="mt-6 flex items-center justify-between p-4 rounded-xl bg-surface-container border border-outline-variant">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-hidden="true" />
        <span className="text-xs font-medium text-on-surface-variant">
          {t('deploy.status')}: <span className="text-on-surface font-bold">{deploy.sha}</span>
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-on-surface-variant" aria-hidden="true" />
          <span className="text-xs text-on-surface-variant">{deploy.ago}</span>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase">
          {deploy.env}
        </span>
      </div>
    </div>
  );
}
