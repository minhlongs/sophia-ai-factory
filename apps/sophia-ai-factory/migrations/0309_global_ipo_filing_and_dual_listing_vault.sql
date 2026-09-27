-- Migration 0309: Global IPO Filing, Dual Listing Vault & SOX 404 Control Ledger
-- Milestone: GATE 10: $5,000,000 MRR ($60,000,000 ARR, 20,000 Paid Customers)
-- Standards: SEC Form S-1 / F-1, SOX Section 404 (ICFR), ASC 830 (FASB Statement 52) CTA,
--            Cloudflare D1 SQLite, millisecond Unix timestamps, strict CHECK constraints.

PRAGMA foreign_keys = ON;

-- ============================================================================
-- 1. ipo_filing_periods
-- SEC Form S-1 / F-1 Prospectus tracking, dual-listing governance,
-- GAAP-to-Non-GAAP reconciliation, and cryptographic Merkle root anchoring.
-- ============================================================================
CREATE TABLE IF NOT EXISTS ipo_filing_periods (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  period_key TEXT NOT NULL UNIQUE, -- e.g. '2026-Q3', '2026-FY', 'S1-PROSPECTUS-2026'
  filing_type TEXT NOT NULL CHECK(filing_type IN ('S-1', 'F-1', '10-K', '10-Q', 'DUAL_LISTING')),
  target_exchanges TEXT NOT NULL DEFAULT 'NASDAQ,SGX',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN (
    'draft', 'review_pending', 'sox_certified', 'board_approved', 'sec_submitted', 'effective', 'archived'
  )),
  filing_date TEXT,     -- 'YYYY-MM-DD'
  effective_date TEXT,  -- 'YYYY-MM-DD'

  -- Scale & Operating Metrics (Gate 10 target: 20,000 customers, $5M MRR, $60M ARR, $250 ARPU, NRR >= 140%)
  total_customers INTEGER NOT NULL DEFAULT 0 CHECK(total_customers >= 0),
  mrr_cents INTEGER NOT NULL DEFAULT 0 CHECK(mrr_cents >= 0),
  arr_cents INTEGER NOT NULL DEFAULT 0 CHECK(arr_cents >= 0),
  arpu_cents INTEGER NOT NULL DEFAULT 0 CHECK(arpu_cents >= 0),
  nrr_pct REAL NOT NULL DEFAULT 0.0 CHECK(nrr_pct >= 0.0),
  gross_margin_pct REAL NOT NULL DEFAULT 0.0 CHECK(gross_margin_pct >= 0.0 AND gross_margin_pct <= 100.0),

  -- GAAP Financial Performance (in cents)
  gaap_revenue_cents INTEGER NOT NULL DEFAULT 0,
  gaap_cost_of_revenue_cents INTEGER NOT NULL DEFAULT 0,
  gaap_gross_profit_cents INTEGER NOT NULL DEFAULT 0,
  gaap_operating_expenses_cents INTEGER NOT NULL DEFAULT 0,
  gaap_operating_income_cents INTEGER NOT NULL DEFAULT 0,
  gaap_net_income_cents INTEGER NOT NULL DEFAULT 0,
  gaap_operating_cash_flow_cents INTEGER NOT NULL DEFAULT 0,
  capex_cents INTEGER NOT NULL DEFAULT 0,

  -- Non-GAAP Reconciliation Line Items (SEC Regulation G & Item 10(e))
  stock_based_compensation_cents INTEGER NOT NULL DEFAULT 0,
  depreciation_amortization_cents INTEGER NOT NULL DEFAULT 0,
  unrealized_fx_gain_loss_cents INTEGER NOT NULL DEFAULT 0,
  one_time_mna_restructuring_cents INTEGER NOT NULL DEFAULT 0,
  adjusted_ebitda_cents INTEGER NOT NULL DEFAULT 0,
  adjusted_ebitda_margin_pct REAL NOT NULL DEFAULT 0.0,
  free_cash_flow_cents INTEGER NOT NULL DEFAULT 0,
  free_cash_flow_margin_pct REAL NOT NULL DEFAULT 0.0,
  magic_number REAL NOT NULL DEFAULT 0.0 CHECK(magic_number >= 0.0), -- Target > 1.5
  rule_of_40_pct REAL NOT NULL DEFAULT 0.0, -- Target >= 65.0%
  yoy_revenue_growth_pct REAL NOT NULL DEFAULT 0.0,

  -- SOX 404 Audit & Cryptographic Anchoring
  sox_404_status TEXT NOT NULL DEFAULT 'untested' CHECK(sox_404_status IN (
    'untested', 'in_progress', 'certified_clean', 'qualified_deficiency', 'adverse_weakness'
  )),
  merkle_root_hash TEXT,
  sec_filing_signature TEXT,
  certified_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  certified_at INTEGER,
  prospectus_metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ifp_period_key ON ipo_filing_periods(period_key);
CREATE INDEX IF NOT EXISTS idx_ifp_status ON ipo_filing_periods(status);
CREATE INDEX IF NOT EXISTS idx_ifp_type ON ipo_filing_periods(filing_type);
CREATE INDEX IF NOT EXISTS idx_ifp_sox_status ON ipo_filing_periods(sox_404_status);

-- ============================================================================
-- 2. sox_404_control_matrix
-- Internal Control over Financial Reporting (ICFR) repository & testing ledger.
-- Enforces preventive blocks on unauthorized manual journal adjustments.
-- ============================================================================
CREATE TABLE IF NOT EXISTS sox_404_control_matrix (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  control_id TEXT NOT NULL UNIQUE, -- e.g. 'SOX-FIN-01', 'SOX-ITGC-01'
  control_name TEXT NOT NULL,
  control_category TEXT NOT NULL CHECK(control_category IN (
    'ENTITY_LEVEL', 'ITGC', 'FINANCIAL_REPORTING', 'SEGREGATION_OF_DUTIES', 'REVENUE_ASSURANCE', 'ACCESS_CONTROL'
  )),
  control_description_en TEXT NOT NULL,
  control_description_vi TEXT NOT NULL,
  coso_framework_pillar TEXT NOT NULL CHECK(coso_framework_pillar IN (
    'CONTROL_ENVIRONMENT', 'RISK_ASSESSMENT', 'CONTROL_ACTIVITIES', 'INFORMATION_COMMUNICATION', 'MONITORING_ACTIVITIES'
  )),
  assertion_tested TEXT NOT NULL CHECK(assertion_tested IN (
    'EXISTENCE', 'COMPLETENESS', 'ACCURACY', 'VALUATION', 'RIGHTS_AND_OBLIGATIONS', 'PRESENTATION_DISCLOSURE'
  )),
  control_frequency TEXT NOT NULL CHECK(control_frequency IN (
    'continuous_realtime', 'daily', 'weekly', 'monthly_close', 'quarterly'
  )),
  automation_level TEXT NOT NULL CHECK(automation_level IN (
    'fully_automated', 'semi_automated', 'manual_detective'
  )),
  is_preventive INTEGER NOT NULL DEFAULT 1 CHECK(is_preventive IN (0, 1)),
  last_evaluated_at INTEGER,
  last_evaluation_status TEXT NOT NULL DEFAULT 'not_tested' CHECK(last_evaluation_status IN (
    'not_tested', 'effective', 'deficiency', 'significant_deficiency', 'material_weakness'
  )),
  unauthorized_attempts_detected INTEGER NOT NULL DEFAULT 0 CHECK(unauthorized_attempts_detected >= 0),
  quarantined_entries_count INTEGER NOT NULL DEFAULT 0 CHECK(quarantined_entries_count >= 0),
  test_evidence_hash TEXT,
  last_tested_by TEXT NOT NULL DEFAULT 'SYSTEM_AUDITOR',
  remediation_plan TEXT,
  remediation_owner TEXT,
  remediation_deadline INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'under_remediation', 'deprecated')),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sox_control_id ON sox_404_control_matrix(control_id);
CREATE INDEX IF NOT EXISTS idx_sox_category ON sox_404_control_matrix(control_category);
CREATE INDEX IF NOT EXISTS idx_sox_eval_status ON sox_404_control_matrix(last_evaluation_status);
CREATE INDEX IF NOT EXISTS idx_sox_frequency ON sox_404_control_matrix(control_frequency);

-- ============================================================================
-- 3. multi_entity_consolidations
-- ASC 830 / IAS 21 Multi-Entity Consolidation with Cumulative Translation
-- Adjustment (CTA) and intercompany elimination balancing.
-- ============================================================================
CREATE TABLE IF NOT EXISTS multi_entity_consolidations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  consolidation_batch_id TEXT NOT NULL,
  period_key TEXT NOT NULL,
  reporting_currency TEXT NOT NULL DEFAULT 'USD',
  entity_code TEXT NOT NULL CHECK(entity_code IN (
    'SOPHIA_GLOBAL_INC', 'SOPHIA_SG_PTE_LTD', 'SOPHIA_VN_CO_LTD', 'CONSOLIDATED_GROUP'
  )),
  functional_currency TEXT NOT NULL CHECK(functional_currency IN ('USD', 'SGD', 'VND')),

  -- Local Functional Financials (in local currency units)
  local_revenue_units REAL NOT NULL DEFAULT 0.0,
  local_operating_expenses_units REAL NOT NULL DEFAULT 0.0,
  local_net_income_units REAL NOT NULL DEFAULT 0.0,
  local_total_assets_units REAL NOT NULL DEFAULT 0.0,
  local_total_liabilities_units REAL NOT NULL DEFAULT 0.0,
  local_equity_units REAL NOT NULL DEFAULT 0.0,

  -- ASC 830 Translation Exchange Rates
  period_end_spot_rate REAL NOT NULL DEFAULT 1.0,        -- Balance sheet translation
  period_weighted_average_rate REAL NOT NULL DEFAULT 1.0, -- P&L translation
  historical_equity_rate REAL NOT NULL DEFAULT 1.0,       -- Common equity translation

  -- Translated Balances (in reporting USD cents)
  translated_revenue_cents INTEGER NOT NULL DEFAULT 0,
  translated_expenses_cents INTEGER NOT NULL DEFAULT 0,
  translated_net_income_cents INTEGER NOT NULL DEFAULT 0,
  translated_assets_cents INTEGER NOT NULL DEFAULT 0,
  translated_liabilities_cents INTEGER NOT NULL DEFAULT 0,
  translated_equity_cents INTEGER NOT NULL DEFAULT 0,

  -- Elimination & Cumulative Translation Adjustment (CTA)
  intercompany_receivables_eliminated_cents INTEGER NOT NULL DEFAULT 0,
  intercompany_payables_eliminated_cents INTEGER NOT NULL DEFAULT 0,
  intercompany_revenue_eliminated_cents INTEGER NOT NULL DEFAULT 0,
  intercompany_expense_eliminated_cents INTEGER NOT NULL DEFAULT 0,
  cumulative_translation_adjustment_cents INTEGER NOT NULL DEFAULT 0,
  cta_balance_type TEXT NOT NULL DEFAULT 'CREDIT' CHECK(cta_balance_type IN ('CREDIT', 'DEBIT', 'ZERO')),
  elimination_balanced INTEGER NOT NULL DEFAULT 1 CHECK(elimination_balanced IN (0, 1)),
  zero_penny_leakage_verified INTEGER NOT NULL DEFAULT 1 CHECK(zero_penny_leakage_verified IN (0, 1)),

  merkle_snapshot_hash TEXT NOT NULL,
  audited_by TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'eliminated', 'reconciled', 'locked', 'audited')),
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(consolidation_batch_id, entity_code)
);

CREATE INDEX IF NOT EXISTS idx_mec_batch_entity ON multi_entity_consolidations(consolidation_batch_id, entity_code);
CREATE INDEX IF NOT EXISTS idx_mec_period ON multi_entity_consolidations(period_key);
CREATE INDEX IF NOT EXISTS idx_mec_status ON multi_entity_consolidations(status);

-- ============================================================================
-- 4. Initial Seed for Canonical SOX 404 Control Matrix
-- Populates the 6 core ICFR internal controls mandated by SEC / PCAOB standards.
-- ============================================================================
INSERT OR IGNORE INTO sox_404_control_matrix (
  control_id,
  control_name,
  control_category,
  control_description_en,
  control_description_vi,
  coso_framework_pillar,
  assertion_tested,
  control_frequency,
  automation_level,
  is_preventive,
  status
) VALUES
(
  'SOX-FIN-01',
  'Segregation of Duties for Journal Entries and Financial Close',
  'SEGREGATION_OF_DUTIES',
  'Enforces strict separation of duties: journal entry preparer cannot be the approver or period close sign-off executive.',
  'Bắt buộc phân tách trách nhiệm: người lập bút toán không thể là người phê duyệt hoặc ký duyệt đóng sổ tài chính.',
  'CONTROL_ACTIVITIES',
  'ACCURACY',
  'continuous_realtime',
  'fully_automated',
  1,
  'active'
),
(
  'SOX-FIN-02',
  'Intercompany Elimination Balancing & CTA Reconciliation',
  'FINANCIAL_REPORTING',
  'Verifies that all intercompany receivables, payables, revenues, and expenses eliminate to zero with balanced CTA under ASC 830.',
  'Xác minh toàn bộ công nợ và doanh thu nội bộ được triệt tiêu cân bằng tuyệt đối kèm đối soát CTA theo chuẩn ASC 830.',
  'CONTROL_ACTIVITIES',
  'VALUATION',
  'monthly_close',
  'fully_automated',
  1,
  'active'
),
(
  'SOX-FIN-03',
  'ASC 606 Revenue Recognition Invariance',
  'REVENUE_ASSURANCE',
  'Ensures total contract value strictly equals recognized revenue plus deferred revenue with zero penny leakage.',
  'Bảo đảm tổng giá trị hợp đồng luôn bằng doanh thu ghi nhận cộng doanh thu hoãn lại không sai lệch một xu.',
  'CONTROL_ACTIVITIES',
  'COMPLETENESS',
  'continuous_realtime',
  'fully_automated',
  1,
  'active'
),
(
  'SOX-ITGC-01',
  'Cryptographic Audit Chain and Merkle Root Integrity',
  'ITGC',
  'Validates the unbroken cryptographic SHA-256 hash chain and Merkle root anchoring of financial close records.',
  'Kiểm tra tính toàn vẹn của chuỗi băm SHA-256 và gốc cây Merkle lưu vết kiểm toán đóng sổ tài chính.',
  'INFORMATION_COMMUNICATION',
  'EXISTENCE',
  'continuous_realtime',
  'fully_automated',
  1,
  'active'
),
(
  'SOX-ITGC-02',
  'Unauthorized Manual Adjustment Quarantine Gate',
  'ACCESS_CONTROL',
  'Automatically blocks and quarantines manual journal adjustments lacking dual authorization or proper cryptographic tokens.',
  'Tự động ngăn chặn và cách ly các bút toán thủ công thiếu phê duyệt kép hoặc thiếu chữ ký số mật mã hợp lệ.',
  'CONTROL_ENVIRONMENT',
  'RIGHTS_AND_OBLIGATIONS',
  'continuous_realtime',
  'fully_automated',
  1,
  'active'
),
(
  'SOX-SEC-01',
  'Regulation G & Item 10(e) Non-GAAP Reconciliation Integrity',
  'FINANCIAL_REPORTING',
  'Verifies mathematical bit-for-bit reconciliation between GAAP Net Income and Non-GAAP Adjusted EBITDA and Free Cash Flow.',
  'Xác minh đối soát toán học chính xác giữa Lợi nhuận ròng GAAP và các chỉ số phi GAAP như Adjusted EBITDA và Dòng tiền tự do.',
  'MONITORING_ACTIVITIES',
  'PRESENTATION_DISCLOSURE',
  'quarterly',
  'fully_automated',
  1,
  'active'
);
