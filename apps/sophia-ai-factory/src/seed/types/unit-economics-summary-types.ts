/**
 * Unit Economics Metrics, Margin, and Summary Contracts.
 * @module seed/types/unit-economics-summary-types
 */

import type { EconomicsProviderId } from './unit-economics-types';

export interface UnitEconomicsMetrics {
  grossMarginPct: number;
  totalRevenueUsd: number;
  totalCogsUsd: number;
  cogsPerVideoUsd: number;
  ltvUsd: number;
  cacUsd: number;
  ltvCacRatio: number;
  breakdownByProvider: Array<{
    provider: EconomicsProviderId;
    totalCostUsd: number;
    percentageOfTotal: number;
  }>;
}

export interface ProviderCostItem {
  provider: EconomicsProviderId | string;
  displayName: string;
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  totalCostUsd: number;
  avgCostPerJobUsd: number;
  costSharePct: number;
  failureRatePct: number;
  avgLatencyMs: number;
}

export interface TierMarginItem {
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  monthlyPriceUsd: number;
  monthlyMcuQuota: number;
  estimatedVideoQuota: number;
  activeSubscribers: number;
  monthlyRevenueUsd: number;
  estimatedCogsUsd: number;
  grossMarginPct: number;
  status: 'OPTIMAL' | 'HEALTHY' | 'COMPRESSED';
}

export interface LtvCacMetrics {
  ltvUsd: number;
  cacUsd: number;
  ltvCacRatio: number;
  arpuUsd: number;
  estimatedMonthlyChurnPct: number;
  estimatedPaybackPeriodMonths: number;
  affiliateCommissionCogsUsd: number;
  directPromoDiscountCogsUsd: number;
  organicPaidCustomers: number;
  affiliateAcquiredCustomers: number;
}

export interface DailyEconomicsTrend {
  date: string;
  revenueUsd: number;
  cogsUsd: number;
  marginPct: number;
  videoJobsCompleted: number;
}

export interface UnitEconomicsSummary {
  metrics: UnitEconomicsMetrics;
  timeframeDays: number;
  totalVideosCompleted: number;
  activePayingCustomers: number;
  arpuUsd: number;
  activeEdgeNodes: number;
  edgeNodeSavingsUsd: number;
  tierEconomics: TierMarginItem[];
  providerCosts: ProviderCostItem[];
  ltvCacMetrics: LtvCacMetrics;
  trends: DailyEconomicsTrend[];
  generatedAt: string;
}
