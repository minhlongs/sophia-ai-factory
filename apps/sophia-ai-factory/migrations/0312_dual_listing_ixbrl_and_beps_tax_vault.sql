-- 0312_dual_listing_ixbrl_and_beps_tax_vault.sql
-- Gate 11: $10,000,000 MRR ($120M ARR, 40,000 Paid Customers)
-- Pillar 1: NASDAQ & SGX Dual-Listing Compliance Engine, Inline XBRL (iXBRL) Tagging & OECD BEPS Pillar Two (15% Global Minimum Tax) Vault

-- 1. Dual Listing Filing Periods (SEC Form 10-K & SGX Catalist)
CREATE TABLE IF NOT EXISTS dual_listing_periods (
  id TEXT PRIMARY KEY,
  period_name TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  fiscal_quarter INTEGER, -- NULL for annual Form 10-K, 1-4 for 10-Q
  filing_type TEXT NOT NULL CHECK(filing_type IN ('SEC_10K', 'SEC_10Q', 'SGX_ANNUAL', 'SGX_SEMIANNUAL')),
  us_cik TEXT NOT NULL DEFAULT '0001984210',
  sgx_ticker TEXT NOT NULL DEFAULT 'SPH.SI',
  currency TEXT NOT NULL DEFAULT 'USD',
  consolidated_revenue_cents INTEGER NOT NULL,
  consolidated_ebitda_cents INTEGER NOT NULL,
  adjusted_ebitda_cents INTEGER NOT NULL,
  free_cash_flow_cents INTEGER NOT NULL,
  net_income_cents INTEGER NOT NULL,
  paid_customers_count INTEGER NOT NULL DEFAULT 40000,
  arpu_cents INTEGER NOT NULL DEFAULT 25000,
  nrr_percentage INTEGER NOT NULL DEFAULT 145,
  rule_of_forty_percentage INTEGER NOT NULL,
  audit_firm_name TEXT NOT NULL DEFAULT 'Ernst & Young LLP (Global)',
  audit_opinion_type TEXT NOT NULL CHECK(audit_opinion_type IN ('UNQUALIFIED', 'QUALIFIED', 'ADVERSE', 'DISCLAIMER')) DEFAULT 'UNQUALIFIED',
  ixbrl_document_uri TEXT,
  sec_edgar_submission_id TEXT,
  sgx_net_announcement_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('DRAFT', 'AUDIT_IN_PROGRESS', 'BOARD_APPROVED', 'FILED', 'AMENDED')) DEFAULT 'DRAFT',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_dual_listing_periods_fy_type ON dual_listing_periods(fiscal_year, filing_type);
CREATE INDEX IF NOT EXISTS idx_dual_listing_periods_status ON dual_listing_periods(status);

-- 2. Inline XBRL (iXBRL) Taxonomy Tagging Registry
CREATE TABLE IF NOT EXISTS ixbrl_taxonomies (
  id TEXT PRIMARY KEY,
  filing_period_id TEXT NOT NULL REFERENCES dual_listing_periods(id) ON DELETE CASCADE,
  standard TEXT NOT NULL CHECK(standard IN ('US_GAAP_2026', 'IFRS_2026', 'SFRS_I_2026')),
  tag_name TEXT NOT NULL,
  context_ref TEXT NOT NULL,
  unit_ref TEXT NOT NULL DEFAULT 'iso4217:USD',
  decimals TEXT NOT NULL DEFAULT '-3',
  value_raw TEXT NOT NULL,
  value_numeric INTEGER,
  is_negated INTEGER NOT NULL DEFAULT 0 CHECK(is_negated IN (0, 1)),
  line_item_description TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_ixbrl_taxonomies_filing ON ixbrl_taxonomies(filing_period_id, tag_name);

-- 3. OECD BEPS Pillar Two 15% Global Minimum Tax Allocations
CREATE TABLE IF NOT EXISTS beps_tax_allocations (
  id TEXT PRIMARY KEY,
  filing_period_id TEXT NOT NULL REFERENCES dual_listing_periods(id) ON DELETE CASCADE,
  jurisdiction_code TEXT NOT NULL CHECK(jurisdiction_code IN ('US', 'SG', 'VN', 'IE', 'KY')),
  covered_taxes_cents INTEGER NOT NULL,
  globe_income_cents INTEGER NOT NULL,
  effective_tax_rate_bps INTEGER NOT NULL, -- e.g. 1500 = 15.00%, 1250 = 12.50%
  minimum_rate_bps INTEGER NOT NULL DEFAULT 1500,
  top_up_tax_percentage_bps INTEGER NOT NULL, -- max(0, 1500 - effective_tax_rate_bps)
  top_up_tax_cents INTEGER NOT NULL,
  substance_carve_out_cents INTEGER NOT NULL DEFAULT 0,
  net_top_up_tax_cents INTEGER NOT NULL,
  safeguard_merkle_root TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_beps_allocations_filing ON beps_tax_allocations(filing_period_id, jurisdiction_code);

-- 4. FCPA / UK Bribery Act Anti-Corruption Screening Ledger
CREATE TABLE IF NOT EXISTS fcpa_compliance_screenings (
  id TEXT PRIMARY KEY,
  filing_period_id TEXT NOT NULL REFERENCES dual_listing_periods(id) ON DELETE CASCADE,
  counterparty_name TEXT NOT NULL,
  counterparty_jurisdiction TEXT NOT NULL,
  screening_type TEXT NOT NULL CHECK(screening_type IN ('PEP_CHECK', 'SANCTIONS_OFAC', 'BRIBERY_RISK', 'TRANSACTION_AUDIT')),
  risk_score INTEGER NOT NULL CHECK(risk_score BETWEEN 0 AND 100),
  disposition TEXT NOT NULL CHECK(disposition IN ('CLEARED', 'FLAGGED', 'ESCALATED_LEGAL', 'BLOCKED')) DEFAULT 'CLEARED',
  reviewed_by TEXT NOT NULL DEFAULT 'AI_CHIEF_LEGAL_OFFICER',
  review_notes TEXT,
  immutable_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_fcpa_screenings_disposition ON fcpa_compliance_screenings(disposition);
