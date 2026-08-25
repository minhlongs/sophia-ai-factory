// i18n-namespace: creativeEconomy
/**
 * Summary Cards — creative economy dashboard overview
 * Displays 30-day revenue, cost, net, and event count.
 */

import type { DashboardSummary } from '@/land/creative-economy/types';

interface SummaryCardsProps {
  summary: DashboardSummary;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function SummaryCards({ summary, t }: SummaryCardsProps) {
  const cards = [
    {
      label: t('revenue'),
      value: formatCents(summary.revenueCents),
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      label: t('cost'),
      value: formatCents(summary.costCents),
      color: 'bg-rose-50 text-rose-700 border-rose-200',
    },
    {
      label: t('net'),
      value: formatCents(summary.netCents),
      color:
        summary.netCents >= 0
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-rose-50 text-rose-700 border-rose-200',
    },
    {
      label: t('eventCount'),
      value: summary.eventCount.toLocaleString(),
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
  ];

  return (
    <section aria-labelledby="summary-heading">
      <h2 id="summary-heading" className="sr-only">
        {t('summaryTitle')}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`rounded-lg border p-3 ${card.color}`}
          >
            <p className="text-xs font-medium opacity-80">{card.label}</p>
            <p className="mt-1 text-lg font-semibold">{card.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {t('windowLabel', { days: summary.windowDays })}
      </p>
    </section>
  );
}