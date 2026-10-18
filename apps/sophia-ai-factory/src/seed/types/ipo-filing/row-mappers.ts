/**
 * @file row-mappers.ts
 * @description Safe database row mappers converting D1 SQLite rows to clean domain entities.
 * @layer seed
 */

import type {
  AssertionTested,
  AutomationLevel,
  ControlEvaluationStatus,
  ControlFrequency,
  CosoFrameworkPillar,
  FilingStatus,
  FilingType,
  Sox404Status,
  SoxControlCategory,
} from './constants-enums';
import type {
  IpoFilingPeriodRow,
  Sox404ControlRow,
} from './db-models';
import type {
  IpoFilingPeriod,
  Sox404Control,
} from './domain-models';

export { mapRowToMultiEntityConsolidation } from './consolidation-row-mapper';

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
