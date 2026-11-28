/**
 * Monetization Dashboard — server component
 * Fetches /api/monetization data and renders summary cards, channel table, and attribution.
 */

export const dynamic = 'force-dynamic';

import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { resolveOrgId } from '@/seed/auth/workspace-access';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { getWorkspaceROI, getTopROIChannels, type ROIAggregate } from '@/tree/roi';
import { aggregateRevenueAttribution } from '@/forest/analytics/queries/revenue-attribution';
import { getDynamicMultiplier } from '@/land/billing/dynamic-pricing-config';
import { VIDEO_MCU_COSTS } from '@/land/billing/video-mcu-cost-config';
import { SummaryCards } from './summary-cards';
import { ChannelTable } from './channel-table';

export interface MonetizationData {
  aggregate: {
    totalRevenueCents: number;
    totalCostCents: number;
    roi: number;
    unitCount: number;
    avgRevenuePerUnit: number;
    avgCostPerUnit: number;
  };
  topChannels: Array<{
    channel: string | null;
    totalRevenueCents: number;
    totalCostCents: number;
    roi: number;
    unitCount: number;
  }>;
  revenueAttribution: Array<{
    channel: string;
    network: string;
    revenueCents: number;
    costCents: number;
    roi: number;
    clicks: number;
    conversions: number;
  }>;
  dynamicPricing: {
    tier: string;
    baseCostMCU: number;
    adjustedCostMCU: number;
    multiplier: number;
  };
}

export default async function MonetizationPage() {
  const t = await getTranslations('monetization');

  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <p role="alert" className="text-sm text-destructive">{t('loading')}</p>
      </div>
    );
  }

  const pageHeader = (
    <header className="mb-6">
      <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t('pageDescription')}</p>
    </header>
  );

  const db = await getD1();
  if (!db) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        {pageHeader}
        <div
          role="alert"
          className="rounded-2xl border border-destructive/35 bg-[var(--error-container)] p-4 text-sm text-[var(--on-error-container)]"
        >
          {t('noData')}
        </div>
      </div>
    );
  }

  const workspaceId = await resolveOrgId(user.id, db);

  if (!workspaceId) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        {pageHeader}
        <div
          role="status"
          className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground"
        >
          {t('noData')}
        </div>
      </div>
    );
  }

  let data: MonetizationData | null = null;
  let error: string | null = null;

  try {
    const [roi, topChannels, revenueAttribution, tier] = await Promise.all([
      getWorkspaceROI(workspaceId),
      getTopROIChannels(workspaceId, 5),
      aggregateRevenueAttribution(workspaceId),
      resolveUserTier(user.id),
    ]);

    const roiData: ROIAggregate = roi ?? {
      workspaceId,
      totalRevenueCents: 0,
      totalCostCents: 0,
      roi: 0,
      unitCount: 0,
      avgRevenuePerUnit: 0,
      avgCostPerUnit: 0,
    };

    const multiplier = getDynamicMultiplier(tier, roiData.unitCount);
    const baseCostMCU = VIDEO_MCU_COSTS.VIDEO_CREATE;
    const adjustedCostMCU = Math.round(baseCostMCU * multiplier);

    data = {
      aggregate: {
        totalRevenueCents: roiData.totalRevenueCents,
        totalCostCents: roiData.totalCostCents,
        roi: roiData.roi,
        unitCount: roiData.unitCount,
        avgRevenuePerUnit: roiData.avgRevenuePerUnit,
        avgCostPerUnit: roiData.avgCostPerUnit,
      },
      topChannels: topChannels.map((c) => ({
        channel: c.channel ?? null,
        totalRevenueCents: c.totalRevenueCents,
        totalCostCents: c.totalCostCents,
        roi: c.roi,
        unitCount: c.unitCount,
      })),
      revenueAttribution,
      dynamicPricing: {
        tier,
        baseCostMCU,
        adjustedCostMCU,
        multiplier,
      },
    };
  } catch {
    error = 'Failed to fetch monetization data';
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('pageDescription')}</p>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/35 bg-[var(--error-container)] p-4 text-sm text-[var(--on-error-container)]"
        >
          {error}
        </div>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : (
        <>
          <SummaryCards aggregate={data.aggregate} dynamicPricing={data.dynamicPricing} t={(k) => t(k)} />
          <ChannelTable
            topChannels={data.topChannels}
            revenueAttribution={data.revenueAttribution}
            t={(k) => t(k)}
          />
        </>
      )}
    </div>
  );
}
