/**
 * Analytics Export Arguments Normalization
 * Layer: tree/partners
 *
 * @module tree/partners/export/args-normalizer
 */

import type {
  PartnerAnalyticsSummary,
  CohortRow,
} from '@/tree/partners/partner-analytics';
import type { PartnerExportBranding } from './types';

/**
 * Normalizes overloaded analytics export arguments supporting either a full
 * PartnerAnalyticsSummary or a raw CohortRow[] list with optional summary dictionary.
 */
export function normalizeAnalyticsArgs(
  analyticsDataOrCohorts: PartnerAnalyticsSummary | CohortRow[],
  partnerInfoOrSummary?: PartnerExportBranding | Record<string, unknown>,
  brandingIfThreeArgs?: PartnerExportBranding,
): { analyticsData: PartnerAnalyticsSummary; partnerInfo?: PartnerExportBranding } {
  if (Array.isArray(analyticsDataOrCohorts)) {
    const cohorts = analyticsDataOrCohorts;
    const summary = (partnerInfoOrSummary ?? {}) as Record<string, unknown>;
    const getNum = (key: string): number | undefined => {
      const val = summary[key];
      return typeof val === 'number' ? val : undefined;
    };
    const partnerInfo = brandingIfThreeArgs;
    const totalMrrCents = getNum('totalEndingMrrCents') ?? getNum('totalMrrCents') ?? 0;
    const activeSubClients =
      getNum('activeClients') ??
      cohorts.reduce(
        (acc, c) =>
          acc +
          (c.currentActiveSize ??
            c.periods?.[c.periods.length - 1]?.activeClients ??
            c.initialSize ??
            0),
        0,
      );
    const analyticsData: PartnerAnalyticsSummary = {
      partnerId: 'partner',
      partnerName: partnerInfo?.brandName ?? partnerInfo?.agencyName ?? 'Enterprise Partner Agency',
      tier: 'PLATINUM',
      period: partnerInfo?.reportPeriod ?? 'Executive Review',
      generatedAt: Date.now(),
      totalSubClients: getNum('totalClients') ?? cohorts.reduce((acc, c) => acc + (c.initialSize || 0), 0),
      activeSubClients,
      totalMrrCents,
      monthlyCommissionCents: Math.round(totalMrrCents * 0.35),
      lifetimeEarningsCents: getNum('totalRealizedRevenueCents') ?? 0,
      totalMcuAllocated: 50000,
      totalMcuConsumed: 10000,
      avgMcuVelocityDaily: 100,
      avgLtvCents: getNum('avgLtvCents') ?? getNum('projectedLtvCents') ?? 0,
      blendedChurnPct: getNum('blendedChurnPct') ?? 0,
      revenueGrowthPct: 0,
      topSubClients: [],
      cohortMatrix: {
        cohorts: cohorts || [],
        summary: {
          totalClients: getNum('totalClients') ?? cohorts.reduce((acc, c) => acc + (c.initialSize || 0), 0),
          activeClients: activeSubClients,
          totalMrrCents,
          avgLtvCents: getNum('avgLtvCents') ?? 0,
          projectedLtvCents: getNum('projectedLtvCents') ?? 0,
          blendedChurnPct: getNum('blendedChurnPct') ?? 0,
          avgM1RetentionPct: getNum('avgM1RetentionPct') ?? 100,
          avgM3RetentionPct: getNum('avgM3RetentionPct') ?? 100,
          overallNrrPct: getNum('overallNrrPct') ?? 100,
          totalCohortsTracked: getNum('totalCohortsTracked') ?? cohorts.length,
        },
      },
    };
    return { analyticsData, partnerInfo };
  }

  return {
    analyticsData: analyticsDataOrCohorts,
    partnerInfo: partnerInfoOrSummary as PartnerExportBranding | undefined,
  };
}
