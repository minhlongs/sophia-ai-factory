'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

export interface DashboardGpuConversionRowProps {
  gpuPercent: number;
  gpuUsed?: number;
  gpuTotal?: number;
  avgConversion?: string;
}

export function DashboardGpuConversionRow({
  gpuPercent,
  gpuUsed,
  gpuTotal,
  avgConversion,
}: DashboardGpuConversionRowProps) {
  const t = useTranslations('stitch.dashboardShell');

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="glass-card p-5 rounded-xl space-y-3">
        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          {t('stats.gpuUsage')}
        </span>
        <div className="w-full bg-surface-container-highest h-1 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${gpuPercent}%` }}
          />
        </div>
        <p className="text-[10px] text-on-surface-variant">
          {gpuUsed ?? 7} / {gpuTotal ?? 10} {t('stats.cores')}
        </p>
      </div>

      <div className="glass-card p-5 rounded-xl space-y-3">
        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          {t('stats.avgConversion')}
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-on-surface">{avgConversion || '4.8%'}</span>
          <span className="text-[10px] text-primary">+2.1%</span>
        </div>
        <p className="text-[10px] text-on-surface-variant">{t('stats.industryAvg')}</p>
      </div>
    </div>
  );
}
