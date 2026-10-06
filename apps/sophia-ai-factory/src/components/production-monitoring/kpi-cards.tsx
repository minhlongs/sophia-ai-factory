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
      color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    },
    {
      label: t('approvalTurnaround'),
      value: formatHours(summary.approvalTurnaroundMedianHours, t),
      color: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
    },
    {
      label: t('retrySuccessPct'),
      value: formatPct(summary.retrySuccessPct, t),
      color: 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-500/20',
    },
    {
      label: t('avgSpendPerRun'),
      value: formatCents(summary.avgSpendPerRunCents, t),
      color: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    },
    {
      label: t('activeRuns'),
      value: t('countUnit', { value: summary.activeRuns }),
      color: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
    },
    {
      label: t('pendingApprovals'),
      value: t('countUnit', { value: summary.pendingApprovals }),
      color: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20',
    },
  ];

  return (
    <section aria-labelledby="production-kpi-heading">
      <h2 id="production-kpi-heading" className="mb-3 text-lg font-semibold text-foreground">
        {t('kpiTitle')}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <div key={card.label} className={`rounded-xl border p-3.5 backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 shadow-sm ${card.color}`}>
            <p className="text-xs font-medium uppercase tracking-wider opacity-80">{card.label}</p>
            <p className="mt-1 text-lg font-bold font-mono tracking-tight">{card.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
