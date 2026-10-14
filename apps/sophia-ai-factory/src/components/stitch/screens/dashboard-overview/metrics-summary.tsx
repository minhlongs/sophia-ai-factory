'use client';

import React from 'react';
import { Megaphone, Eye, DollarSign, Cpu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Progress } from '@/seed/components/ui/progress';
import { StatCard, type StatCardIconColor } from '@/components/stitch';
import { type KpiMetric } from './types';
import { OverviewPerformanceChart } from './overview-performance-chart';

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

      <OverviewPerformanceChart t={(k) => t(k)} />
    </>
  );
}
