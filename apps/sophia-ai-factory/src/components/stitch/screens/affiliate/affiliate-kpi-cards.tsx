'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/seed/utils/cn';
import type { KpiMetric } from './affiliate-dashboard-types';

export function AffiliateKpiCards({ metrics }: { metrics: KpiMetric[] }) {
  const t = useTranslations('stitch.affiliate');

  return (
    <section aria-label={t('aria.kpiSection')}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.id}
              className="bg-surface-container border border-border p-5 rounded-2xl relative overflow-hidden group"
            >
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t(`kpi.${metric.id}.label`)}
                </span>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
              </div>
              <h3 className="text-2xl font-semibold text-foreground">
                {metric.value}
              </h3>
              {metric.subtext && (
                <p className={cn('text-[10px] font-medium mt-0.5', metric.subtextColor ?? 'text-muted-foreground')}>
                  {metric.subtext}
                </p>
              )}
              <div className="mt-3 h-1 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary/40 rounded-full" style={{ width: '60%' }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
