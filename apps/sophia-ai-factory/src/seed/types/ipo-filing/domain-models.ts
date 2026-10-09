/**
 * @file domain-models.ts
 * @description Clean domain entity models for IPO filing, SOX-404 controls, and multi-entity consolidation.
 * @layer seed
 */

import type {
  AssertionTested,
  AutomationLevel,
  ConsolidationEntityCode,
  ConsolidationStatus,
  ControlEvaluationStatus,
  ControlFrequency,
  CosoFrameworkPillar,
  CtaBalanceType,
  FilingStatus,
  FilingType,
  FunctionalCurrency,
  Sox404Status,
  SoxControlCategory,
} from './constants-enums';

export interface IpoFilingPeriod {
  id: string;
  periodKey: string;
  filingType: FilingType;
  targetExchanges: string[];
  status: FilingStatus;
  filingDate: string | null;
  effectiveDate: string | null;
  totalCustomers: number;
  mrrCents: number;
  arrCents: number;
  arpuCents: number;
  nrrPct: number;
  grossMarginPct: number;
  gaapRevenueCents: number;
  gaapCostOfRevenueCents: number;
  gaapGrossProfitCents: number;
  gaapOperatingExpensesCents: number;
  gaapOperatingIncomeCents: number;
  gaapNetIncomeCents: number;
  gaapOperatingCashFlowCents: number;
  capexCents: number;
  stockBasedCompensationCents: number;
  depreciationAmortizationCents: number;
  unrealizedFxGainLossCents: number;
  oneTimeMnaRestructuringCents: number;
  adjustedEbitdaCents: number;
  adjustedEbitdaMarginPct: number;
  freeCashFlowCents: number;
  freeCashFlowMarginPct: number;
  magicNumber: number;
  ruleOf40Pct: number;
  yoyRevenueGrowthPct: number;
  sox404Status: Sox404Status;
  merkleRootHash: string | null;
  secFilingSignature: string | null;
  certifiedBy: string | null;
  certifiedAt: number | null;
  prospectusMetadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface Sox404Control {
  id: string;
  controlId: string;
  controlName: string;
  controlCategory: SoxControlCategory;
  controlDescriptionEn: string;
  controlDescriptionVi: string;
  cosoFrameworkPillar: CosoFrameworkPillar;
  assertionTested: AssertionTested;
  controlFrequency: ControlFrequency;
  automationLevel: AutomationLevel;
  isPreventive: boolean;
  lastEvaluatedAt: number | null;
  lastEvaluationStatus: ControlEvaluationStatus;
  unauthorizedAttemptsDetected: number;
  quarantinedEntriesCount: number;
  testEvidenceHash: string | null;
  lastTestedBy: string;
  remediationPlan: string | null;
  remediationOwner: string | null;
  remediationDeadline: number | null;
  status: 'active' | 'under_remediation' | 'deprecated';
  metadata: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface MultiEntityConsolidation {
  id: string;
  consolidationBatchId: string;
  periodKey: string;
  reportingCurrency: string;
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
  translatedRevenueCents: number;
  translatedExpensesCents: number;
  translatedNetIncomeCents: number;
  translatedAssetsCents: number;
  translatedLiabilitiesCents: number;
  translatedEquityCents: number;
  intercompanyReceivablesEliminatedCents: number;
  intercompanyPayablesEliminatedCents: number;
  intercompanyRevenueEliminatedCents: number;
  intercompanyExpenseEliminatedCents: number;
  cumulativeTranslationAdjustmentCents: number;
  ctaBalanceType: CtaBalanceType;
  eliminationBalanced: boolean;
  zeroPennyLeakageVerified: boolean;
  merkleSnapshotHash: string;
  auditedBy: string | null;
  status: ConsolidationStatus;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}
