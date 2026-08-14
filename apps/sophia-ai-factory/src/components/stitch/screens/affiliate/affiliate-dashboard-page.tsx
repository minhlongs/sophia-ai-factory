'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { AffiliateKpiCards } from './affiliate-kpi-cards';
import { AffiliateOffersGrid } from './affiliate-offers-grid';
import { AffiliateConversionsTable } from './affiliate-conversions-table';
import { AffiliateShareWallet } from './affiliate-share-wallet';
import {
  DEFAULT_METRICS,
  DEFAULT_OFFERS,
  DEFAULT_CONVERSIONS,
} from './affiliate-dashboard-types';
import type { AffiliateDashboardPageProps } from './affiliate-dashboard-types';

// Re-export extracted modules for barrel compatibility
export type { KpiMetric, Offer, ConversionRow, AffiliateDashboardPageProps, SocialPlatform } from './affiliate-dashboard-types';
export { DEFAULT_METRICS, DEFAULT_OFFERS, DEFAULT_CONVERSIONS, STATUS_STYLES, SOCIAL_PLATFORMS } from './affiliate-dashboard-types';
export { SocialIcon } from './affiliate-icons';
export { AffiliateKpiCards } from './affiliate-kpi-cards';
export { AffiliateOffersGrid } from './affiliate-offers-grid';
export { AffiliateConversionsTable } from './affiliate-conversions-table';
export { AffiliateShareWallet } from './affiliate-share-wallet';

/* ═══════════════════════════════════════════════════════════════════════════
 *  AffiliateDashboardPage
 * ═══════════════════════════════════════════════════════════════════════════ */

export default function AffiliateDashboardPage({
  kpiMetrics,
  offers,
  conversions,
  referralLink = 'https://sophia.agencyos.network/r/jane-8472',
  walletAddress = 'TJ9w8D7s...mK2n9R1v',
  walletBalance = '$247.00',
}: AffiliateDashboardPageProps) {
  const t = useTranslations('stitch.affiliate');

  const metrics = kpiMetrics ?? DEFAULT_METRICS;
  const offerItems = offers ?? DEFAULT_OFFERS;
  const conversionRows = conversions ?? DEFAULT_CONVERSIONS;

  return (
    <main className="min-h-screen bg-background px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <AffiliateKpiCards metrics={metrics} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {/* Left column: Offers */}
        <div className="lg:col-span-2">
          <AffiliateOffersGrid offers={offerItems} />
        </div>

        {/* Right column: Share + Wallet */}
        <div className="space-y-6">
          <AffiliateShareWallet
            referralLink={referralLink}
            walletAddress={walletAddress}
            walletBalance={walletBalance}
          />
        </div>
      </div>

      {/* Conversions Table */}
      <div className="mt-8">
        <AffiliateConversionsTable conversions={conversionRows} />
      </div>
    </main>
  );
}
