/**
 * @file service-types.ts
 * @description Input, reconciliation, evaluation, certificate, and document payload interfaces for IPO filing.
 * @layer seed
 */

import type {
  ConsolidationEntityCode,
  ControlEvaluationStatus,
  CtaBalanceType,
  FilingStatus,
  FilingType,
  FunctionalCurrency,
  Sox404Status,
  SoxControlCategory,
} from './constants-enums';
import type { MultiEntityConsolidation } from './domain-models';

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

export interface JournalAdjustmentInput {
  id?: string;
  periodKey: string;
  accountCode: string;
  entityCode: ConsolidationEntityCode;
  debitCents: number;
  creditCents: number;
  requestedBy: string;
  approvedBy?: string;
  reason: string;
  isAuthorized: boolean;
  authorizationToken?: string;
}

export interface SoxValidationResult {
  isAllowed: boolean;
  quarantined: boolean;
  violatedControlIds: string[];
  reason: string;
  auditEvidenceHash: string;
}

export interface SoxControlEvaluation {
  controlId: string;
  controlName: string;
  category: SoxControlCategory;
  status: ControlEvaluationStatus;
  isEffective: boolean;
  testedAt: number;
  testedBy: string;
  evidenceHash: string;
  findings: string[];
  unauthorizedAttemptsDetected: number;
  quarantinedEntriesCount: number;
}

export interface SoxEvaluationSummary {
  overallStatus: Sox404Status;
  totalControlsTested: number;
  effectiveControlsCount: number;
  deficienciesCount: number;
  evaluations: SoxControlEvaluation[];
  merkleRootHash: string;
  certifiedAt: number;
}

export interface SoxAttestationCertificate {
  certificateId: string;
  periodKey: string;
  soxStatus: Sox404Status;
  certifierId: string;
  certifierRole: string;
  signedAt: number;
  merkleRootHash: string;
  digitalSignature: string;
  statementEn: string;
  statementVi: string;
}

export interface S1ProspectusDocument {
  filingId: string;
  periodKey: string;
  filingType: FilingType;
  targetExchanges: string[];
  status: FilingStatus;
  scaleMetrics: {
    totalCustomers: number;
    mrrCents: number;
    arrCents: number;
    arpuCents: number;
    nrrPct: number;
    grossMarginPct: number;
  };
  gaapFinancials: GaapFinancialsInput;
  nonGaapFinancials: NonGaapReconciliationResult;
  consolidationSummary: MultiEntityConsolidationResult;
  sox404Evaluation: SoxEvaluationSummary;
  merkleRootHash: string;
  secFilingSignature: string;
  generatedAt: number;
}

export interface CreateIpoPeriodInput {
  periodKey: string;
  filingType: FilingType;
  targetExchanges?: string[];
  totalCustomers: number;
  mrrCents: number;
  arrCents: number;
  arpuCents: number;
  nrrPct: number;
  gaapFinancials: GaapFinancialsInput;
  prospectusMetadata?: Record<string, unknown>;
}

export interface ConsolidateCtaInput {
  periodKey: string;
  entities: EntityFinancialInput[];
  notes?: string;
}
