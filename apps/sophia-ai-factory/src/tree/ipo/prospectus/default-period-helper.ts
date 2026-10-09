/**
 * S-1 Prospectus Engine: Default Filing Period Helper
 *
 * Provides fallback Gate 10 scale model and canonical 3-entity model.
 *
 * Layer: tree (Domain logic)
 *
 * @module tree/ipo/prospectus/default-period-helper
 */

import {
  GATE10_SCALE_TARGETS,
  CANONICAL_ENTITIES,
  type ConsolidationEntityCode,
  type EntityFinancialInput,
  type IpoFilingPeriod,
} from '@/seed/types/ipo-filing';

export function buildDefaultPeriod(periodKey: string, timestamp: number): IpoFilingPeriod {
  return {
    id: `ifp_${periodKey.toLowerCase()}`,
    periodKey,
    filingType: 'S-1',
    targetExchanges: ['NASDAQ', 'SGX'],
    status: 'review_pending',
    filingDate: new Date().toISOString().split('T')[0],
    effectiveDate: null,
    totalCustomers: GATE10_SCALE_TARGETS.TOTAL_CUSTOMERS,
    mrrCents: GATE10_SCALE_TARGETS.MRR_CENTS,
    arrCents: GATE10_SCALE_TARGETS.ARR_CENTS,
    arpuCents: GATE10_SCALE_TARGETS.ARPU_CENTS,
    nrrPct: GATE10_SCALE_TARGETS.MIN_NRR_PCT,
    grossMarginPct: 82.5,
    gaapRevenueCents: 15_000_000_00,
    gaapCostOfRevenueCents: 2_625_000_00,
    gaapGrossProfitCents: 12_375_000_00,
    gaapOperatingExpensesCents: 8_500_000_00,
    gaapOperatingIncomeCents: 3_875_000_00,
    gaapNetIncomeCents: 3_100_000_00,
    gaapOperatingCashFlowCents: 4_200_000_00,
    capexCents: 450_000_00,
    stockBasedCompensationCents: 500_000_00,
    depreciationAmortizationCents: 350_000_00,
    unrealizedFxGainLossCents: -50_000_00,
    oneTimeMnaRestructuringCents: 100_000_00,
    adjustedEbitdaCents: 4_000_000_00,
    adjustedEbitdaMarginPct: 26.67,
    freeCashFlowCents: 3_750_000_00,
    freeCashFlowMarginPct: 25.0,
    magicNumber: 2.0,
    ruleOf40Pct: 75.0,
    yoyRevenueGrowthPct: 50.0,
    sox404Status: 'certified_clean',
    merkleRootHash: null,
    secFilingSignature: null,
    certifiedBy: null,
    certifiedAt: null,
    prospectusMetadata: {},
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function buildCanonicalEntities(): EntityFinancialInput[] {
  return [
    {
      entityCode: CANONICAL_ENTITIES.US_INC as ConsolidationEntityCode,
      functionalCurrency: 'USD',
      localRevenueUnits: 10_000_000,
      localOperatingExpensesUnits: 6_000_000,
      localNetIncomeUnits: 4_000_000,
      localTotalAssetsUnits: 25_000_000,
      localTotalLiabilitiesUnits: 10_000_000,
      localEquityUnits: 11_000_000,
      periodEndSpotRate: 1.0,
      periodWeightedAverageRate: 1.0,
      historicalEquityRate: 1.0,
      intercompanyReceivablesEliminatedCents: 500_000_00,
      intercompanyPayablesEliminatedCents: 0,
      intercompanyRevenueEliminatedCents: 300_000_00,
      intercompanyExpenseEliminatedCents: 0,
    },
    {
      entityCode: CANONICAL_ENTITIES.SG_PTE_LTD as ConsolidationEntityCode,
      functionalCurrency: 'SGD',
      localRevenueUnits: 4_000_000,
      localOperatingExpensesUnits: 2_500_000,
      localNetIncomeUnits: 1_500_000,
      localTotalAssetsUnits: 10_000_000,
      localTotalLiabilitiesUnits: 4_000_000,
      localEquityUnits: 4_500_000,
      periodEndSpotRate: 0.74,
      periodWeightedAverageRate: 0.75,
      historicalEquityRate: 0.72,
      intercompanyReceivablesEliminatedCents: 0,
      intercompanyPayablesEliminatedCents: 500_000_00,
      intercompanyRevenueEliminatedCents: 0,
      intercompanyExpenseEliminatedCents: 300_000_00,
    },
    {
      entityCode: CANONICAL_ENTITIES.VN_CO_LTD as ConsolidationEntityCode,
      functionalCurrency: 'VND',
      localRevenueUnits: 50_000_000_000,
      localOperatingExpensesUnits: 30_000_000_000,
      localNetIncomeUnits: 20_000_000_000,
      localTotalAssetsUnits: 100_000_000_000,
      localTotalLiabilitiesUnits: 40_000_000_000,
      localEquityUnits: 40_000_000_000,
      periodEndSpotRate: 0.00003929,
      periodWeightedAverageRate: 0.00003937,
      historicalEquityRate: 0.00004000,
    },
  ];
}
