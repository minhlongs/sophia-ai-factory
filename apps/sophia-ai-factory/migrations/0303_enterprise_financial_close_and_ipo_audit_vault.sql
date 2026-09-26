-- Migration 0303: Enterprise Financial Close Automation & IPO-Ready Audit Governance
-- Milestone: $1,000,000 MRR Scale & Autonomous Enterprise (Gate 8 Pillar 1)
-- Standards: ASC 606 / IFRS 15 / VAS TT200 / Sarbanes-Oxley (SOX) Section 404 / SEC Form S-1
-- Target: Cloudflare D1 (sophia-raas-db)

PRAGMA foreign_keys = ON;

-- ============================================================================
-- 1. financial_close_periods
-- Formal accounting period registry, close state machine, and Merkle root anchor.
-- ============================================================================
CREATE TABLE IF NOT EXISTS financial_close_periods (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE, -- NULL for consolidated group level
  period_key TEXT NOT NULL, -- e.g. '2026-09', '2026-Q3', '2026-FY'
  period_type TEXT NOT NULL CHECK(period_type IN ('monthly', 'quarterly', 'annual')),
  start_date TEXT NOT NULL, -- ISO-8601 'YYYY-MM-DD'
  end_date TEXT NOT NULL,   -- ISO-8601 'YYYY-MM-DD'
  close_status TEXT NOT NULL DEFAULT 'open' CHECK(close_status IN ('open', 'closing', 'closed', 'locked', 'audited', 'reopened')),
  closed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  closed_at INTEGER,
  total_recognized_revenue_cents INTEGER NOT NULL DEFAULT 0,
  total_deferred_revenue_cents INTEGER NOT NULL DEFAULT 0,
  total_refunds_cents INTEGER NOT NULL DEFAULT 0,
  net_revenue_cents INTEGER NOT NULL DEFAULT 0,
  active_contracts_count INTEGER NOT NULL DEFAULT 0,
  merkle_root_hash TEXT,
  digital_signature TEXT,
  compliance_frameworks TEXT NOT NULL DEFAULT 'ASC_606,IFRS_15,VAS_TT200,SOX_404',
  audit_opinion TEXT NOT NULL DEFAULT 'unqualified' CHECK(audit_opinion IN ('unqualified', 'qualified', 'adverse', 'disclaimer', 'pending')),
  lock_reason TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(org_id, period_key)
);

CREATE INDEX IF NOT EXISTS idx_fcp_period_key ON financial_close_periods(period_key);
CREATE INDEX IF NOT EXISTS idx_fcp_status ON financial_close_periods(close_status);
CREATE INDEX IF NOT EXISTS idx_fcp_dates ON financial_close_periods(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_fcp_org ON financial_close_periods(org_id, close_status);

-- ============================================================================
-- 2. revenue_schedules
-- Daily accrued revenue recognition schedules per ASC 606 / IFRS 15.
-- Invariance rule: total_contract_value_cents == recognized_revenue_cents + deferred_revenue_cents
-- ============================================================================
CREATE TABLE IF NOT EXISTS revenue_schedules (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  contract_id TEXT NOT NULL, -- External invoice, transaction, or enterprise SLA contract ID
  tier TEXT NOT NULL CHECK(tier IN ('BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER', 'CUSTOM')),
  billing_cycle TEXT NOT NULL CHECK(billing_cycle IN ('monthly', 'annual', 'lifetime', 'custom')),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency IN ('USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD', 'CAD', 'VND', 'THB', 'IDR', 'USDT', 'USDC')),
  total_contract_value_cents INTEGER NOT NULL,
  recognized_revenue_cents INTEGER NOT NULL DEFAULT 0,
  deferred_revenue_cents INTEGER NOT NULL,
  daily_recognition_rate_cents REAL NOT NULL,
  start_date TEXT NOT NULL, -- 'YYYY-MM-DD'
  end_date TEXT NOT NULL,   -- 'YYYY-MM-DD'
  term_days INTEGER NOT NULL,
  days_recognized INTEGER NOT NULL DEFAULT 0,
  accounting_standard TEXT NOT NULL DEFAULT 'ASC_606_IFRS_15' CHECK(accounting_standard IN ('ASC_606_IFRS_15', 'VAS_TT200', 'HYBRID_DUAL_LEDGER')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'paused', 'cancelled', 'refunded')),
  last_accrual_date TEXT,   -- 'YYYY-MM-DD'
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_rs_org_status ON revenue_schedules(org_id, status);
CREATE INDEX IF NOT EXISTS idx_rs_contract ON revenue_schedules(contract_id);
CREATE INDEX IF NOT EXISTS idx_rs_tier ON revenue_schedules(tier);
CREATE INDEX IF NOT EXISTS idx_rs_dates ON revenue_schedules(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_rs_last_accrual ON revenue_schedules(last_accrual_date);

-- ============================================================================
-- 3. intercompany_transfers
-- Cross-border intercompany transfer pricing, withholding tax, and reconciliation.
-- ============================================================================
CREATE TABLE IF NOT EXISTS intercompany_transfers (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  transfer_reference TEXT NOT NULL UNIQUE, -- e.g. 'ICT-2026-09-001'
  origin_entity TEXT NOT NULL CHECK(origin_entity IN ('SOPHIA_GLOBAL_INC', 'SOPHIA_VN_CO_LTD', 'SOPHIA_SG_PTE_LTD', 'SOPHIA_EU_BV', 'SOPHIA_PARTNER_FEDERATION')),
  destination_entity TEXT NOT NULL CHECK(destination_entity IN ('SOPHIA_GLOBAL_INC', 'SOPHIA_VN_CO_LTD', 'SOPHIA_SG_PTE_LTD', 'SOPHIA_EU_BV', 'SOPHIA_PARTNER_FEDERATION')),
  transfer_type TEXT NOT NULL CHECK(transfer_type IN ('ip_license_royalty', 'service_fee', 'cost_sharing_recharge', 'mcu_compute_rebill', 'dividend_distribution')),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency IN ('USD', 'EUR', 'GBP', 'JPY', 'SGD', 'VND', 'USDT')),
  gross_amount_cents INTEGER NOT NULL,
  withholding_tax_regime TEXT NOT NULL CHECK(withholding_tax_regime IN ('VN_FCT_10PCT', 'VN_FCT_5PCT', 'US_W8_30PCT', 'US_W8_TREATY_0PCT', 'SG_DTA_EXEMPT', 'NONE')),
  withholding_tax_rate_pct REAL NOT NULL DEFAULT 0.0,
  withholding_tax_amount_cents INTEGER NOT NULL DEFAULT 0,
  net_settlement_cents INTEGER NOT NULL, -- gross - wht
  settlement_status TEXT NOT NULL DEFAULT 'pending' CHECK(settlement_status IN ('pending', 'approved', 'reconciled', 'settled', 'disputed', 'cancelled')),
  reconciliation_ledger_id TEXT,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  transfer_date TEXT NOT NULL, -- 'YYYY-MM-DD'
  settled_at INTEGER,
  supporting_docs_hash TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ict_ref ON intercompany_transfers(transfer_reference);
CREATE INDEX IF NOT EXISTS idx_ict_entities ON intercompany_transfers(origin_entity, destination_entity, settlement_status);
CREATE INDEX IF NOT EXISTS idx_ict_transfer_date ON intercompany_transfers(transfer_date);
CREATE INDEX IF NOT EXISTS idx_ict_tax_regime ON intercompany_transfers(withholding_tax_regime);

-- ============================================================================
-- 4. ipo_audit_ledger
-- Monotonically sequenced tamper-evident audit ledger with SHA-256 hash chaining
-- and digital signature for SEC Form S-1 and VAS TT200 certification.
-- ============================================================================
CREATE TABLE IF NOT EXISTS ipo_audit_ledger (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  sequence_number INTEGER NOT NULL UNIQUE,
  period_key TEXT NOT NULL,
  org_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK(event_type IN (
    'REVENUE_SCHEDULE_CREATED',
    'REVENUE_DAILY_ACCRUED',
    'PERIOD_PRE_CLOSE_AUDIT',
    'PERIOD_CLOSED',
    'PERIOD_LOCKED',
    'INTERCOMPANY_TRANSFER_POSTED',
    'INTERCOMPANY_RECONCILED',
    'REFUND_REVERSAL_POSTED',
    'MERKLE_ROOT_ANCHORED',
    'SOX_CONTROL_CERTIFIED'
  )),
  event_scope TEXT NOT NULL CHECK(event_scope IN ('entity_level', 'consolidated_group', 'system_wide')),
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK(actor_role IN ('SYSTEM', 'CFO', 'CONTROLLER', 'EXTERNAL_AUDITOR', 'SOX_COMPLIANCE_OFFICER')),
  amount_cents INTEGER NOT NULL DEFAULT 0,
  payload_canonical_json TEXT NOT NULL DEFAULT '{}',
  prev_hash TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  merkle_leaf_hash TEXT NOT NULL,
  digital_signature TEXT NOT NULL,
  sox_control_id TEXT NOT NULL DEFAULT 'NONE' CHECK(sox_control_id IN ('CC-1.1', 'CC-2.1', 'CC-3.2', 'CC-5.1', 'AC-4.1', 'AC-6.2', 'NONE')),
  vas_account_code TEXT, -- e.g. '511', '3387', '112', '136', '336', '3338'
  timestamp INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ial_seq ON ipo_audit_ledger(sequence_number);
CREATE INDEX IF NOT EXISTS idx_ial_period ON ipo_audit_ledger(period_key, event_type);
CREATE INDEX IF NOT EXISTS idx_ial_hashes ON ipo_audit_ledger(prev_hash, content_hash);
CREATE INDEX IF NOT EXISTS idx_ial_timestamp ON ipo_audit_ledger(timestamp DESC);
