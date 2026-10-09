/**
 * @file db-models.ts
 * @description Raw D1 SQLite database row interfaces for IPO filing and SOX-404 tables.
 * @layer seed
 */

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
