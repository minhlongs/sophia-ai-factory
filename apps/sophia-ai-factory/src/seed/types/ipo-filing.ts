/**
 * Global IPO Filing, Dual Listing Vault & SOX 404 Control Ledger Types
 *
 * Defines the canonical types for Pillar 1 of Milestone Gate 10:
 * - SEC Form S-1 / F-1 Prospectus Filing & Dual-Listing Governance
 * - Regulation G & Item 10(e) Non-GAAP Financial Metrics (Adjusted EBITDA, FCF, Magic Number, Rule of 40)
 * - ASC 830 Multi-Entity Cumulative Translation Adjustment (CTA) & Elimination Ledger
 * - Sarbanes-Oxley (SOX) Section 404 Internal Control over Financial Reporting (ICFR)
 * - Cryptographic Tamper-Evident Attestation and Merkle Anchoring
 *
 * Layer: seed/types (Foundational, Zero upward dependencies)
 *
 * @module seed/types/ipo-filing
 */

// ============================================================================
// Canonical Constants & Targets
// ============================================================================

export const GATE10_SCALE_TARGETS = {
  MRR_CENTS: 500_000_000,         // $5,000,000.00
  ARR_CENTS: 6_000_000_000,       // $60,000,000.00
  TOTAL_CUSTOMERS: 20_000,        // 20,000 paid subscribers
  ARPU_CENTS: 25_000,             // $250.00
  MIN_NRR_PCT: 140.0,             // >= 140% Net Revenue Retention
  MIN_MAGIC_NUMBER: 1.5,          // > 1.5 Sales Efficiency
  MIN_RULE_OF_40_PCT: 65.0,       // >= 65% Growth + FCF Margin
  TARGET_EXCHANGES: ['NASDAQ', 'SGX'] as const,
} as const;

export const CANONICAL_ENTITIES = {
  US_INC: 'SOPHIA_GLOBAL_INC',
  SG_PTE_LTD: 'SOPHIA_SG_PTE_LTD',
  VN_CO_LTD: 'SOPHIA_VN_CO_LTD',
  CONSOLIDATED: 'CONSOLIDATED_GROUP',
} as const;

export const SOX_CONTROL_IDS = {
  SOD: 'SOX-FIN-01',
  INTERCOMPANY: 'SOX-FIN-02',
  ASC606_REVENUE: 'SOX-FIN-03',
  CRYPTO_INTEGRITY: 'SOX-ITGC-01',
  QUARANTINE_ADJUSTMENT: 'SOX-ITGC-02',
  REG_G_NON_GAAP: 'SOX-SEC-01',
} as const;

// ============================================================================
// Enumerations & Domain Unions
// ============================================================================

export type FilingType = 'S-1' | 'F-1' | '10-K' | '10-Q' | 'DUAL_LISTING';

export type FilingStatus =
  | 'draft'
  | 'review_pending'
  | 'sox_certified'
  | 'board_approved'
  | 'sec_submitted'
  | 'effective'
  | 'archived';

export type Sox404Status =
  | 'untested'
  | 'in_progress'
  | 'certified_clean'
  | 'qualified_deficiency'
  | 'adverse_weakness';

export type SoxControlCategory =
  | 'ENTITY_LEVEL'
  | 'ITGC'
  | 'FINANCIAL_REPORTING'
  | 'SEGREGATION_OF_DUTIES'
  | 'REVENUE_ASSURANCE'
  | 'ACCESS_CONTROL';

export type CosoFrameworkPillar =
  | 'CONTROL_ENVIRONMENT'
  | 'RISK_ASSESSMENT'
  | 'CONTROL_ACTIVITIES'
  | 'INFORMATION_COMMUNICATION'
  | 'MONITORING_ACTIVITIES';

export type AssertionTested =
  | 'EXISTENCE'
  | 'COMPLETENESS'
  | 'ACCURACY'
  | 'VALUATION'
  | 'RIGHTS_AND_OBLIGATIONS'
  | 'PRESENTATION_DISCLOSURE';

export type ControlFrequency =
  | 'continuous_realtime'
  | 'daily'
  | 'weekly'
  | 'monthly_close'
  | 'quarterly';

export type AutomationLevel =
  | 'fully_automated'
  | 'semi_automated'
  | 'manual_detective';

export type ControlEvaluationStatus =
  | 'not_tested'
  | 'effective'
  | 'deficiency'
  | 'significant_deficiency'
  | 'material_weakness';

export type ConsolidationEntityCode =
  | 'SOPHIA_GLOBAL_INC'
  | 'SOPHIA_SG_PTE_LTD'
  | 'SOPHIA_VN_CO_LTD'
  | 'CONSOLIDATED_GROUP';

export type FunctionalCurrency = 'USD' | 'SGD' | 'VND';

export type CtaBalanceType = 'CREDIT' | 'DEBIT' | 'ZERO';

export type ConsolidationStatus =
  | 'draft'
  | 'eliminated'
  | 'reconciled'
  | 'locked'
  | 'audited';

// ============================================================================
// D1 Database Raw Row Interfaces
// ============================================================================

export interface IpoFilingPeriodRow {
  id: string;
  period_key: string;
  filing_type: string;
  target_exchanges: string;
  status: string;
  filing_date: string | null;
  effective_date: string | null;
  total_customers: number;
  mrr_cents: number;
  arr_cents: number;
  arpu_cents: number;
  nrr_pct: number;
  gross_margin_pct: number;
  gaap_revenue_cents: number;
  gaap_cost_of_revenue_cents: number;
  gaap_gross_profit_cents: number;
  gaap_operating_expenses_cents: number;
  gaap_operating_income_cents: number;
  gaap_net_income_cents: number;
  gaap_operating_cash_flow_cents: number;
  capex_cents: number;
  stock_based_compensation_cents: number;
  depreciation_amortization_cents: number;
  unrealized_fx_gain_loss_cents: number;
  one_time_mna_restructuring_cents: number;
  adjusted_ebitda_cents: number;
  adjusted_ebitda_margin_pct: number;
  free_cash_flow_cents: number;
  free_cash_flow_margin_pct: number;
  magic_number: number;
  rule_of_40_pct: number;
  yoy_revenue_growth_pct: number;
  sox_404_status: string;
  merkle_root_hash: string | null;
  sec_filing_signature: string | null;
  certified_by: string | null;
  certified_at: number | null;
  prospectus_metadata_json: string;
  created_at: number;
  updated_at: number;
}

export interface Sox404ControlRow {
  id: string;
  control_id: string;
  control_name: string;
  control_category: string;
  control_description_en: string;
  control_description_vi: string;
  coso_framework_pillar: string;
  assertion_tested: string;
  control_frequency: string;
  automation_level: string;
  is_preventive: number;
  last_evaluated_at: number | null;
  last_evaluation_status: string;
  unauthorized_attempts_detected: number;
  quarantined_entries_count: number;
  test_evidence_hash: string | null;
  last_tested_by: string;
  remediation_plan: string | null;
  remediation_owner: string | null;
  remediation_deadline: number | null;
  status: string;
  metadata_json: string;
  created_at: number;
  updated_at: number;
}

export interface MultiEntityConsolidationRow {
  id: string;
  consolidation_batch_id: string;
  period_key: string;
  reporting_currency: string;
  entity_code: string;
  functional_currency: string;
  local_revenue_units: number;
  local_operating_expenses_units: number;
  local_net_income_units: number;
  local_total_assets_units: number;
  local_total_liabilities_units: number;
  local_equity_units: number;
  period_end_spot_rate: number;
  period_weighted_average_rate: number;
  historical_equity_rate: number;
  translated_revenue_cents: number;
  translated_expenses_cents: number;
  translated_net_income_cents: number;
  translated_assets_cents: number;
  translated_liabilities_cents: number;
  translated_equity_cents: number;
  intercompany_receivables_eliminated_cents: number;
  intercompany_payables_eliminated_cents: number;
  intercompany_revenue_eliminated_cents: number;
  intercompany_expense_eliminated_cents: number;
  cumulative_translation_adjustment_cents: number;
  cta_balance_type: string;
  elimination_balanced: number;
  zero_penny_leakage_verified: number;
  merkle_snapshot_hash: string;
  audited_by: string | null;
  status: string;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

// ============================================================================
// Clean Domain Entity Models
// ============================================================================

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

// ============================================================================
// Computational Input & Result Interfaces
// ============================================================================

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

// Action Inputs
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

// ============================================================================
// Row Mappers
// ============================================================================

export function mapRowToIpoFilingPeriod(row: IpoFilingPeriodRow): IpoFilingPeriod {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(row.prospectus_metadata_json || '{}') as Record<string, unknown>;
  } catch {
    metadata = {};
  }

  return {
    id: row.id,
    periodKey: row.period_key,
    filingType: row.filing_type as FilingType,
    targetExchanges: (row.target_exchanges || 'NASDAQ,SGX').split(',').map((e) => e.trim()),
    status: row.status as FilingStatus,
    filingDate: row.filing_date,
    effectiveDate: row.effective_date,
    totalCustomers: row.total_customers,
    mrrCents: row.mrr_cents,
    arrCents: row.arr_cents,
    arpuCents: row.arpu_cents,
    nrrPct: row.nrr_pct,
    grossMarginPct: row.gross_margin_pct,
    gaapRevenueCents: row.gaap_revenue_cents,
    gaapCostOfRevenueCents: row.gaap_cost_of_revenue_cents,
    gaapGrossProfitCents: row.gaap_gross_profit_cents,
    gaapOperatingExpensesCents: row.gaap_operating_expenses_cents,
    gaapOperatingIncomeCents: row.gaap_operating_income_cents,
    gaapNetIncomeCents: row.gaap_net_income_cents,
    gaapOperatingCashFlowCents: row.gaap_operating_cash_flow_cents,
    capexCents: row.capex_cents,
    stockBasedCompensationCents: row.stock_based_compensation_cents,
    depreciationAmortizationCents: row.depreciation_amortization_cents,
    unrealizedFxGainLossCents: row.unrealized_fx_gain_loss_cents,
    oneTimeMnaRestructuringCents: row.one_time_mna_restructuring_cents,
    adjustedEbitdaCents: row.adjusted_ebitda_cents,
    adjustedEbitdaMarginPct: row.adjusted_ebitda_margin_pct,
    freeCashFlowCents: row.free_cash_flow_cents,
    freeCashFlowMarginPct: row.free_cash_flow_margin_pct,
    magicNumber: row.magic_number,
    ruleOf40Pct: row.rule_of_40_pct,
    yoyRevenueGrowthPct: row.yoy_revenue_growth_pct,
    sox404Status: row.sox_404_status as Sox404Status,
    merkleRootHash: row.merkle_root_hash,
    secFilingSignature: row.sec_filing_signature,
    certifiedBy: row.certified_by,
    certifiedAt: row.certified_at,
    prospectusMetadata: metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRowToSox404Control(row: Sox404ControlRow): Sox404Control {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(row.metadata_json || '{}') as Record<string, unknown>;
  } catch {
    metadata = {};
  }

  return {
    id: row.id,
    controlId: row.control_id,
    controlName: row.control_name,
    controlCategory: row.control_category as SoxControlCategory,
    controlDescriptionEn: row.control_description_en,
    controlDescriptionVi: row.control_description_vi,
    cosoFrameworkPillar: row.coso_framework_pillar as CosoFrameworkPillar,
    assertionTested: row.assertion_tested as AssertionTested,
    controlFrequency: row.control_frequency as ControlFrequency,
    automationLevel: row.automation_level as AutomationLevel,
    isPreventive: Boolean(row.is_preventive),
    lastEvaluatedAt: row.last_evaluated_at,
    lastEvaluationStatus: row.last_evaluation_status as ControlEvaluationStatus,
    unauthorizedAttemptsDetected: row.unauthorized_attempts_detected,
    quarantinedEntriesCount: row.quarantined_entries_count,
    testEvidenceHash: row.test_evidence_hash,
    lastTestedBy: row.last_tested_by,
    remediationPlan: row.remediation_plan,
    remediationOwner: row.remediation_owner,
    remediationDeadline: row.remediation_deadline,
    status: row.status as 'active' | 'under_remediation' | 'deprecated',
    metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRowToMultiEntityConsolidation(
  row: MultiEntityConsolidationRow
): MultiEntityConsolidation {
  return {
    id: row.id,
    consolidationBatchId: row.consolidation_batch_id,
    periodKey: row.period_key,
    reportingCurrency: row.reporting_currency,
    entityCode: row.entity_code as ConsolidationEntityCode,
    functionalCurrency: row.functional_currency as FunctionalCurrency,
    localRevenueUnits: row.local_revenue_units,
    localOperatingExpensesUnits: row.local_operating_expenses_units,
    localNetIncomeUnits: row.local_net_income_units,
    localTotalAssetsUnits: row.local_total_assets_units,
    localTotalLiabilitiesUnits: row.local_total_liabilities_units,
    localEquityUnits: row.local_equity_units,
    periodEndSpotRate: row.period_end_spot_rate,
    periodWeightedAverageRate: row.period_weighted_average_rate,
    historicalEquityRate: row.historical_equity_rate,
    translatedRevenueCents: row.translated_revenue_cents,
    translatedExpensesCents: row.translated_expenses_cents,
    translatedNetIncomeCents: row.translated_net_income_cents,
    translatedAssetsCents: row.translated_assets_cents,
    translatedLiabilitiesCents: row.translated_liabilities_cents,
    translatedEquityCents: row.translated_equity_cents,
    intercompanyReceivablesEliminatedCents: row.intercompany_receivables_eliminated_cents,
    intercompanyPayablesEliminatedCents: row.intercompany_payables_eliminated_cents,
    intercompanyRevenueEliminatedCents: row.intercompany_revenue_eliminated_cents,
    intercompanyExpenseEliminatedCents: row.intercompany_expense_eliminated_cents,
    cumulativeTranslationAdjustmentCents: row.cumulative_translation_adjustment_cents,
    ctaBalanceType: row.cta_balance_type as CtaBalanceType,
    eliminationBalanced: Boolean(row.elimination_balanced),
    zeroPennyLeakageVerified: Boolean(row.zero_penny_leakage_verified),
    merkleSnapshotHash: row.merkle_snapshot_hash,
    auditedBy: row.audited_by,
    status: row.status as ConsolidationStatus,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
