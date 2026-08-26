// i18n-namespace: productionMonitoring
/**
 * KPI Cards — six roadmap KPIs for the autonomous production pipeline.
 * Server component; receives pre-fetched summary + translator from the page.
 * Null ratios render as "no data" so an empty database is safe.
 *
 * @module components/production-monitoring/kpi-cards
 */

import type { ProductionDashboardSummary } from '@/land/production-monitoring/types';

type TFn = (key: string, values?: Record<string, string | number | Date>) => string;

interface KpiCardsProps {
  summary: ProductionDashboardSummary;
  t: TFn;
}

function formatPct(value: number | null, t: TFn): string {
  return value === null ? t('noData') : t('percentUnit', { value });
}

function formatHours(value: number | null, t: TFn): string {
  return value === null ? t('noData') : t('hoursUnit', { value });
}

function formatCents(cents: number | null, t: TFn): string {
  return cents === null ? t('noData') : t('centsUnit', { value: (cents / 100).toFixed(2) });
}

export function KpiCards({ summary, t }: KpiCardsProps) {
  const cards = [
    {
      label: t('completionPct'),
      value: formatPct(summary.completionPct, t),
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      label: t('approvalTurnaround'),
      value: formatHours(summary.approvalTurnaroundMedianHours, t),
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    {
      label: t('retrySuccessPct'),
      value: formatPct(summary.retrySuccessPct, t),
      color: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      label: t('avgSpendPerRun'),
      value: formatCents(summary.avgSpendPerRunCents, t),
      color: 'bg-rose-50 text-rose-700 border-rose-200',
    },
    {
      label: t('activeRuns'),
      value: t('countUnit', { value: summary.activeRuns }),
      color: 'bg-sky-50 text-sky-700 border-sky-200',
    },
    {
      label: t('pendingApprovals'),
      value: t('countUnit', { value: summary.pendingApprovals }),
      color: 'bg-violet-50 text-violet-700 border-violet-200',
    },
  ];

  return (
    <section aria-labelledby="production-kpi-heading">
      <h2 id="production-kpi-heading" className="mb-3 text-lg font-semibold text-foreground">
        {t('kpiTitle')}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <div key={card.label} className={`rounded-lg border p-3 ${card.color}`}>
            <p className="text-xs font-medium opacity-80">{card.label}</p>
            <p className="mt-1 text-lg font-semibold">{card.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
