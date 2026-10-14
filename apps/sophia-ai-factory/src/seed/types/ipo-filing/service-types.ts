/**
 * @file service-types.ts
 * @description Input, reconciliation, evaluation, certificate, and document payload interfaces for IPO filing.
 * @layer seed
 */

import type {
  ConsolidationEntityCode,
  CtaBalanceType,
  FunctionalCurrency,
} from './constants-enums';
import type { MultiEntityConsolidation } from './domain-models';

export * from './sox-prospectus-types';

export interface GaapFinancialsInput {
  revenueCents: number;
  costOfRevenueCents: number;
  operatingExpensesCents: number;
  netIncomeCents: number;
  operatingCashFlowCents: number;
  capexCents: number;
  stockBasedCompensationCents: number;
  depreciationAmortizationCents: number;
  unrealizedFxGainLossCents?: number;
  oneTimeMnaRestructuringCents?: number;
  priorQuarterRevenueCents?: number;
  priorQuarterSmExpenseCents?: number;
  priorYearRevenueCents?: number;
}

export interface NonGaapReconciliationResult {
  gaapGrossProfitCents: number;
  grossMarginPct: number;
  gaapOperatingIncomeCents: number;
  adjustedEbitdaCents: number;
  adjustedEbitdaMarginPct: number;
  freeCashFlowCents: number;
  freeCashFlowMarginPct: number;
  magicNumber: number;
  magicNumberPassed: boolean;
  yoyRevenueGrowthPct: number;
  ruleOf40Pct: number;
  ruleOf40Passed: boolean;
  reconciliationNotes: string[];
}

export interface EntityFinancialInput {
  entityCode: ConsolidationEntityCode;
  functionalCurrency: FunctionalCurrency;
  localRevenueUnits: number;
  localOperatingExpensesUnits: number;
  localNetIncomeUnits: number;
  localTotalAssetsUnits: number;
  localTotalLiabilitiesUnits: number;
  localEquityUnits: number;
  periodEndSpotRate: number;
  periodWeightedAverageRate: number;
  historicalEquityRate: number;
  intercompanyReceivablesEliminatedCents?: number;
  intercompanyPayablesEliminatedCents?: number;
  intercompanyRevenueEliminatedCents?: number;
  intercompanyExpenseEliminatedCents?: number;
}

export interface MultiEntityConsolidationResult {
  consolidationBatchId: string;
  periodKey: string;
  entities: MultiEntityConsolidation[];
  consolidatedGroup: MultiEntityConsolidation;
  totalTranslatedAssetsCents: number;
  totalTranslatedLiabilitiesCents: number;
  totalTranslatedEquityCents: number;
  cumulativeTranslationAdjustmentCents: number;
  ctaBalanceType: CtaBalanceType;
  intercompanyEliminationsBalanced: boolean;
  zeroPennyLeakageVerified: boolean;
  merkleSnapshotHash: string;
}
