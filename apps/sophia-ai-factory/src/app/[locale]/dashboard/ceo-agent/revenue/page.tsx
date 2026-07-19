/** /dashboard/ceo-agent/revenue — Phase 4: Revenue Insights
 *
 *  Server Component tier-gated route.
 *  - BASIC tier: returns null — CeoAgentShell renders TierGateCard.
 *  - PREMIUM/ENTERPRISE/MASTER: hydrates RevenueClient with initial data.
 */

import { loadCeoAgentPage } from '@/land/ceo-agent/load-ceo-agent-page';
import { getRevenueInsights } from './actions';
import { getTranslations } from 'next-intl/server';
import { RevenueClient } from './revenue-client';
import type { RevenueInsights } from './actions';

export const dynamic = 'force-dynamic';

export interface RevenuePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: RevenuePageProps) {
  const { locale } = await params;
  const t = await getTranslations('dashboard.ceoAgent');
  return {
    title: `${t('revenueTitle')} | Sophia AI`,
    description: t('revenueDesc'),
  };
}

export default async function RevenuePage({ params }: RevenuePageProps) {
  const initial = await loadCeoAgentPage({ params });
  if (initial.userTier === 'BASIC') return null;

  const t = await getTranslations('dashboard.ceoAgent');

  const insightsResult = await getRevenueInsights();
  const initialInsights: RevenueInsights = insightsResult.ok && insightsResult.insights
    ? insightsResult.insights
    : {
        totalSpentUsd: 0,
        totalCreditsUsed: 0,
        totalCreditsPurchased: 0,
        remainingCredits: 0,
        avgDailySpend7d: 0,
        trend30d: [],
        tier: initial.userTier,
      };

  return (
    <RevenueClient
      locale={initial.locale}
      userId={initial.user.id}
      initialInsights={initialInsights}
      titleLabel={t('revenueTitle')}
      subtitleLabel={t('revenueDesc')}
      spentLabel={t('revenueSpentLabel')}
      purchasedLabel={t('revenuePurchasedLabel')}
      usedLabel={t('revenueUsedLabel')}
      remainingLabel={t('revenueRemainingLabel')}
      avgSpendLabel={t('revenueAvgSpendLabel')}
      trendLabel={t('revenueTrendLabel')}
      noDataLabel={t('revenueNoData')}
      tierLabel={t('revenueTierLabel')}
      refreshLabel={t('revenueRefresh')}
      refreshingLabel={t('revenueRefreshing')}
      retryLabel={t('retryLabel')}
      errorLabel={t('revenueError')}
      txTitleLabel={t('recentTransactionsTitle')}
      txDateLabel={t('txDateLabel')}
      txAmountLabel={t('txAmountLabel')}
      txCreditsLabel={t('txCreditsLabel')}
      txSkuLabel={t('txSkuLabel')}
      emptyTxLabel={t('revenueEmptyTx')}
    />
  );
}
