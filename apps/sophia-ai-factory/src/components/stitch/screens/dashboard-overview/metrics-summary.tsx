'use client';

import React from 'react';
import { Megaphone, Eye, DollarSign, Cpu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Progress } from '@/seed/components/ui/progress';
import { StatCard, type StatCardIconColor } from '@/components/stitch';
import {
  type KpiMetric,
  CHART_GRADIENT_ID,
  CHART_LABEL_COUNT,
} from './types';

interface MetricsSummaryProps {
  metrics: KpiMetric[];
}

const KPI_CONFIGS: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: StatCardIconColor }
> = {
  activeCampaigns: { icon: Megaphone, color: 'indigo' },
  totalViews: { icon: Eye, color: 'emerald' },
  revenueMtd: { icon: DollarSign, color: 'violet' },
  creditsUsed: { icon: Cpu, color: 'amber' },
};

export function MetricsSummary({ metrics }: MetricsSummaryProps) {
  const t = useTranslations('stitch.dashboardOverview');

  return (
    <>
      {/* ── KPI Row ───────────────────────────────────────────── */}
      <section
        aria-label={t('aria.kpiSection')}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        {metrics.map((metric) => {
          const config = KPI_CONFIGS[metric.id] || { icon: Megaphone, color: 'primary' };
          const Icon = config.icon;

          return (
            <StatCard
              key={metric.id}
              label={t(`kpi.${metric.id}.label`)}
              value={metric.value}
              icon={Icon}
              iconColor={config.color}
              trend={
                metric.trend
                  ? {
                      value: metric.trend,
                      isPositive: metric.trendDirection === 'up',
                    }
                  : undefined
              }
              subtitle={
                metric.id === 'creditsUsed' && metric.progressMax != null
                  ? `/ ${metric.progressMax.toLocaleString()}`
                  : undefined
              }
            >
              {metric.sparkline && (
                <div className="h-8 mt-2" aria-hidden="true">
                  <svg
                    className="w-full h-full overflow-visible"
                    viewBox="0 0 100 20"
                    role="img"
                    aria-label={t('aria.sparkline')}
                  >
                    <path
                      d="M0 15 Q 10 5, 20 12 T 40 8 T 60 14 T 80 4 T 100 10"
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              )}
              {metric.id === 'creditsUsed' && metric.progressValue != null && (
                <Progress
                  value={metric.progressValue}
                  max={metric.progressMax ?? 100}
                  className="w-full h-2 mt-2"
                  indicatorClassName="bg-amber-400"
                  aria-label={t('kpi.creditsUsed.progressLabel', {
                    used: metric.value,
                    total: metric.progressMax?.toLocaleString() ?? '10,000',
                  })}
                />
              )}
            </StatCard>
          );
        })}
      </section>

      {/* ── Performance Chart ─────────────────────────────────── */}
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
            {/* Grid Lines */}
            <line stroke="hsl(var(--muted))" strokeWidth="1" x1="0" x2="100%" y1="20%" y2="20%" />
            <line stroke="hsl(var(--muted))" strokeWidth="1" x1="0" x2="100%" y1="40%" y2="40%" />
            <line stroke="hsl(var(--muted))" strokeWidth="1" x1="0" x2="100%" y1="60%" y2="60%" />
            <line stroke="hsl(var(--muted))" strokeWidth="1" x1="0" x2="100%" y1="80%" y2="80%" />
            {/* Area */}
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

          {/* Tooltip indicator */}
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
                <span className="text-xs font-bold text-white">
                  {t('chart.tooltip.viewsValue')}
                </span>
              </div>
              <div className="flex justify-between gap-8">
                <span className="text-xs text-on-surface">{t('chart.tooltip.revenue')}</span>
                <span className="text-xs font-bold text-white">
                  {t('chart.tooltip.revenueValue')}
                </span>
              </div>
            </div>
          </div>
          <div
            className="absolute bottom-[240px] left-[60%] -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-primary ring-4 ring-primary/20"
            aria-hidden="true"
          />
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between mt-4 text-[11px] text-on-surface-variant px-1">
          {Array.from({ length: CHART_LABEL_COUNT }, (_, idx) => (
            <span key={idx}>{t(`chart.labels.${idx}`)}</span>
          ))}
        </div>
      </section>
    </>
  );
}
