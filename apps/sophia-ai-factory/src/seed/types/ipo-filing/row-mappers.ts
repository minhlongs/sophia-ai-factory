/**
 * @file row-mappers.ts
 * @description Safe database row mappers converting D1 SQLite rows to clean domain entities.
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
import type {
  IpoFilingPeriodRow,
  MultiEntityConsolidationRow,
  Sox404ControlRow,
} from './db-models';
import type {
  IpoFilingPeriod,
  MultiEntityConsolidation,
  Sox404Control,
} from './domain-models';

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
