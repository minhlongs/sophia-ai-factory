// i18n-namespace: stitch.dashboardOverview
'use client';

import React from 'react';
import { CHART_GRADIENT_ID, CHART_LABEL_COUNT } from './types';

export function OverviewPerformanceChart({ t }: { t: (key: string) => string }) {
  return (
    <section
      aria-label={t('aria.chartSection')}
      className="bg-surface-container border border-outline-variant/10 rounded-2xl p-8 mb-8 relative"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h3 className="text-lg font-bold text-white">{t('chart.title')}</h3>
        <div className="flex gap-4" role="group" aria-label={t('aria.chartLegend')}>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-primary" aria-hidden="true" />
            <span className="text-xs text-on-surface-variant">{t('chart.legend.views')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-secondary" aria-hidden="true" />
            <span className="text-xs text-on-surface-variant">{t('chart.legend.revenue')}</span>
          </div>
        </div>
      </div>

      <div className="relative h-[300px] w-full mt-8">
        <svg
          className="w-full h-full"
          preserveAspectRatio="none"
          role="img"
          aria-label={t('aria.chart')}
        >
          <defs>
            <linearGradient id={CHART_GRADIENT_ID} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line stroke="hsl(var(--muted))" strokeWidth="1" x1="0" x2="100%" y1="20%" y2="20%" />
          <line stroke="hsl(var(--muted))" strokeWidth="1" x1="0" x2="100%" y1="40%" y2="40%" />
          <line stroke="hsl(var(--muted))" strokeWidth="1" x1="0" x2="100%" y1="60%" y2="60%" />
          <line stroke="hsl(var(--muted))" strokeWidth="1" x1="0" x2="100%" y1="80%" y2="80%" />
          <path
            d="M0 250 L50 220 L150 180 L250 240 L350 100 L450 160 L550 80 L650 120 L750 60 L850 110 L950 90 L1050 50 L1200 40 L1200 300 L0 300 Z"
            fill={`url(#${CHART_GRADIENT_ID})`}
          />
          <path
            d="M0 250 L50 220 L150 180 L250 240 L350 100 L450 160 L550 80 L650 120 L750 60 L850 110 L950 90 L1050 50 L1200 40"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeLinecap="round"
            strokeWidth="3"
          />
        </svg>

        <div
          className="absolute top-10 left-[60%] -translate-x-1/2 p-3 rounded-lg bg-black/60 backdrop-blur-md border border-primary/30 shadow-2xl z-10"
          role="tooltip"
          aria-label={t('chart.tooltip.label')}
        >
          <p className="text-[10px] text-on-surface-variant font-bold uppercase mb-1">
            {t('chart.tooltip.date')}
          </p>
          <div className="space-y-1">
            <div className="flex justify-between gap-8">
              <span className="text-xs text-on-surface">{t('chart.tooltip.views')}</span>
              <span className="text-xs font-bold text-white">{t('chart.tooltip.viewsValue')}</span>
            </div>
            <div className="flex justify-between gap-8">
              <span className="text-xs text-on-surface">{t('chart.tooltip.revenue')}</span>
              <span className="text-xs font-bold text-white">{t('chart.tooltip.revenueValue')}</span>
            </div>
          </div>
        </div>
        <div
          className="absolute bottom-[240px] left-[60%] -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-primary ring-4 ring-primary/20"
          aria-hidden="true"
        />
      </div>

      <div className="flex justify-between mt-4 text-[11px] text-on-surface-variant px-1">
        {Array.from({ length: CHART_LABEL_COUNT }, (_, idx) => (
          <span key={idx}>{t(`chart.labels.${idx}`)}</span>
        ))}
      </div>
    </section>
  );
}
