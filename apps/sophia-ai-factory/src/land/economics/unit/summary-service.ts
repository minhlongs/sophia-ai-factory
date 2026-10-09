/**
 * Unit Economics Submodule: Summary Service.
 * Layer: land (Domain service)
 *
 * @module land/economics/unit/summary-service
 */

import { getD1 } from '@/seed/db/client';
import { createLogger } from '@/seed/utils/logger-utility';
import type { D1Database } from '@cloudflare/workers-types';
import type {
  LtvCacMetrics,
  UnitEconomicsSummary,
} from '@/seed/types/unit-economics-types';
import { BENCHMARK_UNIT_ECONOMICS } from './benchmarks';
import {
  calculateGrossMarginPct,
  calculateCogsPerVideo,
  calculateLtvCac,
} from './calculators';
import {
  buildProviderBreakdown,
  buildProviderCosts,
} from './provider-cost-aggregator';
import { buildTierEconomics } from './tier-economics-builder';
import {
  queryMediaJobs,
  queryLicenses,
  querySettledRevenue,
  queryAffiliateCommissions,
  queryActiveEdgeNodes,
} from './d1-queries';

const logger = createLogger('land/economics/unit/summary-service');

const TIER_PRICES = { BASIC: 199, PREMIUM: 399, ENTERPRISE: 799, MASTER: 4999 };

/**
 * Aggregates real-time unit economics across Cloudflare D1 tables.
 */
export async function getUnitEconomicsSummary(
  timeframeDays = 30,
  dbOverride?: D1Database
): Promise<UnitEconomicsSummary> {
  const db = dbOverride || (await getD1());

  if (!db) {
    logger.warn('UNIT_ECONOMICS_D1_UNAVAILABLE — returning benchmark');
    return { ...BENCHMARK_UNIT_ECONOMICS, timeframeDays };
  }

  const windowStartMs = Date.now() - timeframeDays * 24 * 60 * 60 * 1000;
  const windowStartSec = Math.floor(windowStartMs / 1000);

  try {
    const [
      mediaJobsResult,
      licensesResult,
      settledRevenueUsd,
      totalCommissionsUsd,
      activeEdgeNodes,
    ] = await Promise.all([
      queryMediaJobs(db, windowStartSec),
      queryLicenses(db),
      querySettledRevenue(db),
      queryAffiliateCommissions(db),
      queryActiveEdgeNodes(db),
    ]);

    const { totalVideos, totalMediaJobsCogsCents, providerCounts } = mediaJobsResult;
    const { tierCounts, activeLicenseCount } = licensesResult;

    // If D1 is completely empty (fresh environment), fall back to benchmark
    if (totalVideos === 0 && activeLicenseCount === 0 && settledRevenueUsd === 0) {
      return { ...BENCHMARK_UNIT_ECONOMICS, timeframeDays };
    }

    const monthlyLicenseRevenue =
      tierCounts.BASIC * TIER_PRICES.BASIC +
      tierCounts.PREMIUM * TIER_PRICES.PREMIUM +
      tierCounts.ENTERPRISE * TIER_PRICES.ENTERPRISE +
      tierCounts.MASTER * TIER_PRICES.MASTER;

    const totalRevenueUsd = Math.max(settledRevenueUsd, monthlyLicenseRevenue);
    const totalCogsUsd = Number((totalMediaJobsCogsCents / 100).toFixed(2));
    const grossMarginPct = calculateGrossMarginPct(totalRevenueUsd, totalCogsUsd);
    const cogsPerVideoUsd = calculateCogsPerVideo(totalCogsUsd, totalVideos);

    const activePayingCustomers = Math.max(1, activeLicenseCount);
    const arpuUsd = Number((totalRevenueUsd / activePayingCustomers).toFixed(2));

    const churnPct = 5.0; // 5% monthly churn baseline
    const totalAcqSpend = Math.max(totalCommissionsUsd, totalRevenueUsd * 0.15);
    const { ltvUsd, cacUsd, ltvCacRatio, paybackMonths } = calculateLtvCac({
      arpuUsd,
      grossMarginPct,
      monthlyChurnPct: churnPct,
      totalAcquisitionSpendUsd: totalAcqSpend,
      acquiredCustomersCount: activePayingCustomers,
    });

    const breakdownByProvider = buildProviderBreakdown(providerCounts, totalMediaJobsCogsCents);
    const providerCosts = buildProviderCosts(providerCounts, totalMediaJobsCogsCents);

    // Mekong edge savings: number of edge jobs * cloud baseline cost ($0.112)
    const edgeNodeSavingsUsd = Number((providerCounts.mekong.success * 0.112).toFixed(2));

    const tierEconomics = buildTierEconomics(tierCounts, cogsPerVideoUsd);

    const ltvCacMetrics: LtvCacMetrics = {
      ltvUsd,
      cacUsd,
      ltvCacRatio,
      arpuUsd,
      estimatedMonthlyChurnPct: churnPct,
      estimatedPaybackPeriodMonths: paybackMonths,
      affiliateCommissionCogsUsd: totalCommissionsUsd,
      directPromoDiscountCogsUsd: 0,
      organicPaidCustomers: Math.max(1, Math.round(activePayingCustomers * 0.7)),
      affiliateAcquiredCustomers: Math.max(0, Math.round(activePayingCustomers * 0.3)),
    };

    return {
      metrics: {
        grossMarginPct,
        totalRevenueUsd,
        totalCogsUsd,
        cogsPerVideoUsd,
        ltvUsd,
        cacUsd,
        ltvCacRatio,
        breakdownByProvider,
      },
      timeframeDays,
      totalVideosCompleted: totalVideos,
      activePayingCustomers,
      arpuUsd,
      activeEdgeNodes,
      edgeNodeSavingsUsd,
      tierEconomics,
      providerCosts,
      ltvCacMetrics,
      trends: BENCHMARK_UNIT_ECONOMICS.trends,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.error('UNIT_ECONOMICS_SERVICE_ERROR', { error: String(err) });
    return { ...BENCHMARK_UNIT_ECONOMICS, timeframeDays };
  }
}
