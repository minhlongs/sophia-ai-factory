/**
 * Unit Economics Submodule: Benchmarks & Constants.
 * Layer: land (Domain service)
 *
 * @module land/economics/unit/benchmarks
 */

import type { UnitEconomicsSummary } from '@/seed/types/unit-economics-types';
import {
  BENCHMARK_TIER_ECONOMICS,
  BENCHMARK_PROVIDER_COSTS,
} from './benchmark-breakdowns';

export const BENCHMARK_UNIT_ECONOMICS: UnitEconomicsSummary = {
  metrics: {
    grossMarginPct: 88.6,
    totalRevenueUsd: 14750.0,
    totalCogsUsd: 1681.5,
    cogsPerVideoUsd: 0.0825,
    ltvUsd: 3540.0,
    cacUsd: 735.0,
    ltvCacRatio: 4.82,
    breakdownByProvider: [
      { provider: 'fal', totalCostUsd: 840.2, percentageOfTotal: 50.0 },
      { provider: 'elevenlabs', totalCostUsd: 588.1, percentageOfTotal: 35.0 },
      { provider: 'openrouter', totalCostUsd: 253.2, percentageOfTotal: 15.0 },
      { provider: 'mekong', totalCostUsd: 0.0, percentageOfTotal: 0.0 },
    ],
  },
  timeframeDays: 30,
  totalVideosCompleted: 20380,
  activePayingCustomers: 38,
  arpuUsd: 388.15,
  activeEdgeNodes: 3,
  edgeNodeSavingsUsd: 1426.6,
  tierEconomics: BENCHMARK_TIER_ECONOMICS,
  providerCosts: BENCHMARK_PROVIDER_COSTS,
  ltvCacMetrics: {
    ltvUsd: 3540.0,
    cacUsd: 735.0,
    ltvCacRatio: 4.82,
    arpuUsd: 388.15,
    estimatedMonthlyChurnPct: 4.5,
    estimatedPaybackPeriodMonths: 2.1,
    affiliateCommissionCogsUsd: 2950.0,
    directPromoDiscountCogsUsd: 800.0,
    organicPaidCustomers: 26,
    affiliateAcquiredCustomers: 12,
  },
  trends: [
    { date: '2026-09-17', revenueUsd: 1850, cogsUsd: 210, marginPct: 88.6, videoJobsCompleted: 2450 },
    { date: '2026-09-24', revenueUsd: 2100, cogsUsd: 235, marginPct: 88.8, videoJobsCompleted: 2800 },
    { date: '2026-10-01', revenueUsd: 2450, cogsUsd: 270, marginPct: 89.0, videoJobsCompleted: 3200 },
    { date: '2026-10-08', revenueUsd: 2800, cogsUsd: 310, marginPct: 88.9, videoJobsCompleted: 3650 },
  ],
  generatedAt: new Date().toISOString(),
};
