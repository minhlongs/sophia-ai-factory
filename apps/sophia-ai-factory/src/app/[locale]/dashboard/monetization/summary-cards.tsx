// i18n-namespace: monetization
/**
 * Summary Cards — monetization dashboard overview
 * Displays aggregate revenue, cost, ROI, and unit metrics.
 */

import type { MonetizationData } from './page';

interface SummaryCardsProps {
  aggregate: MonetizationData['aggregate'];
  dynamicPricing: MonetizationData['dynamicPricing'];
  t: (key: string) => string;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function SummaryCards({ aggregate, dynamicPricing, t }: SummaryCardsProps) {
  const cards = [
    { label: t('totalRevenue'), value: formatCents(aggregate.totalRevenueCents), color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { label: t('totalCost'), value: formatCents(aggregate.totalCostCents), color: 'bg-rose-50 text-rose-700 border-rose-200' },
    { label: t('roi'), value: formatPercent(aggregate.roi), color: aggregate.roi >= 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200' },
    { label: t('unitCount'), value: aggregate.unitCount.toLocaleString(), color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { label: t('avgRevenuePerUnit'), value: formatCents(aggregate.avgRevenuePerUnit), color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { label: t('avgCostPerUnit'), value: formatCents(aggregate.avgCostPerUnit), color: 'bg-rose-50 text-rose-700 border-rose-200' },
  ];

  return (
    <section>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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

      <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
        <h3 className="text-sm font-semibold text-indigo-700">{t('dynamicPricing')}</h3>
        <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-indigo-600/70">{t('currentTier')}</span>
            <p className="font-semibold text-indigo-800">{dynamicPricing.tier}</p>
          </div>
          <div>
            <span className="text-indigo-600/70">{t('baseCostMCU')}</span>
            <p className="font-semibold text-indigo-800">{dynamicPricing.baseCostMCU}</p>
          </div>
          <div>
            <span className="text-indigo-600/70">{t('adjustedCostMCU')}</span>
            <p className="font-semibold text-indigo-800">{dynamicPricing.adjustedCostMCU}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-indigo-600/70">
          {t('multiplier')}: {dynamicPricing.multiplier}x
        </p>
      </div>
    </section>
  );
}
