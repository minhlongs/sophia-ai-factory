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
    { label: t('totalRevenue'), value: formatCents(aggregate.totalRevenueCents), color: 'bg-success/10 text-success border-success/30' },
    { label: t('totalCost'), value: formatCents(aggregate.totalCostCents), color: 'bg-[var(--error-container)] text-[var(--on-error-container)] border-destructive/30' },
    { label: t('roi'), value: formatPercent(aggregate.roi), color: aggregate.roi >= 0 ? 'bg-[var(--tertiary-container)] text-[var(--on-tertiary-container)] border-accent/30' : 'bg-[var(--error-container)] text-[var(--on-error-container)] border-destructive/30' },
    { label: t('unitCount'), value: aggregate.unitCount.toLocaleString(), color: 'bg-[var(--primary-container)] text-[var(--on-primary-container)] border-primary/30' },
    { label: t('avgRevenuePerUnit'), value: formatCents(aggregate.avgRevenuePerUnit), color: 'bg-success/10 text-success border-success/30' },
    { label: t('avgCostPerUnit'), value: formatCents(aggregate.avgCostPerUnit), color: 'bg-[var(--error-container)] text-[var(--on-error-container)] border-destructive/30' },
  ];

  return (
    <section>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`rounded-2xl border p-3.5 ${card.color}`}
          >
            <p className="text-xs font-medium opacity-80">{card.label}</p>
            <p className="md3-tabular-nums mt-1 text-lg font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-primary/30 bg-[var(--primary-container)] p-4">
        <h3 className="text-sm font-semibold text-[var(--on-primary-container)]">{t('dynamicPricing')}</h3>
        <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-[var(--on-primary-container)]/75">{t('currentTier')}</span>
            <p className="font-semibold text-[var(--on-primary-container)]">{dynamicPricing.tier}</p>
          </div>
          <div>
            <span className="text-[var(--on-primary-container)]/75">{t('baseCostMCU')}</span>
            <p className="md3-tabular-nums font-semibold text-[var(--on-primary-container)]">{dynamicPricing.baseCostMCU}</p>
          </div>
          <div>
            <span className="text-[var(--on-primary-container)]/75">{t('adjustedCostMCU')}</span>
            <p className="md3-tabular-nums font-semibold text-[var(--on-primary-container)]">{dynamicPricing.adjustedCostMCU}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-[var(--on-primary-container)]/75">
          {t('multiplier')}: {dynamicPricing.multiplier}x
        </p>
      </div>
    </section>
  );
}
