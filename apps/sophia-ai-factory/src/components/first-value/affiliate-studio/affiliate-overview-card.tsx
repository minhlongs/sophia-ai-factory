'use client';

/**
 * Step 0 — Affiliate Campaign Studio Overview KPI & Journey Progress Card.
 *
 * Shows real D1 state only: BYOK status, saved Affiliate Offers, generated/approved
 * Campaigns, confirmed vs pending commission, and transparent AI spend.
 *
 * @module components/first-value/affiliate-studio/affiliate-overview-card
 */

import { useTranslations } from 'next-intl';
import {
  formatAffiliateCurrencyAmount,
  type AffiliateRevenueSnapshot,
} from '@/land/first-value/pilot-affiliate-studio-revenue';

export interface AffiliateOverviewCardProps {
  readonly byokConfigured: boolean;
  readonly offersCount: number;
  readonly revenue: AffiliateRevenueSnapshot;
}

export function AffiliateOverviewCard({
  byokConfigured,
  offersCount,
  revenue,
}: AffiliateOverviewCardProps) {
  const t = useTranslations('firstValue');

  const netLabel =
    revenue.netRevenueUsd !== null
      ? formatAffiliateCurrencyAmount(revenue.netRevenueUsd, 'USD')
      : revenue.netRevenueUnavailableReason === 'NON_USD_COMMISSION' &&
          revenue.confirmedCommissionUsd !== null
        ? `${formatAffiliateCurrencyAmount(revenue.confirmedCommissionUsd, revenue.currency)} (− $${revenue.estimatedAiCostUsd.toFixed(2)} AI)`
        : t('affMultiCurrencyBadge');

  return (
    <section id="overview" className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t('affOverviewTitle')}</h2>
          <p className="text-xs text-muted-foreground">{t('affOverviewSubtitle')}</p>
        </div>
        <span
          className={
            revenue.partnerFeedStatus === 'CONNECTED'
              ? 'rounded-full bg-emerald-500/15 px-3 py-1 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400'
              : 'rounded-full bg-amber-500/15 px-3 py-1 font-mono text-xs font-medium text-amber-600 dark:text-amber-400'
          }
        >
          {t('affPartnerFeedLabel')}: {revenue.partnerFeedStatus}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <dt className="text-xs text-muted-foreground">{t('affKpiByok')}</dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-foreground">
            {byokConfigured ? t('pilotByokReadyBadge') : t('pilotByokMissingBadge')}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <dt className="text-xs text-muted-foreground">{t('affKpiOffers')}</dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-foreground">{offersCount}</dd>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <dt className="text-xs text-muted-foreground">{t('affKpiCampaigns')}</dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-foreground">
            {revenue.totalCampaigns} ({revenue.approvedCampaigns} {t('affApprovedShort')})
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <dt className="text-xs text-muted-foreground">{t('affKpiNetRevenue')}</dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-primary">{netLabel}</dd>
        </div>
      </dl>
    </section>
  );
}
