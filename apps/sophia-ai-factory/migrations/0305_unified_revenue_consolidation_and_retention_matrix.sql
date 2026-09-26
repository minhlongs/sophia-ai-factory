-- Migration 0305: Unified Revenue Engine Consolidation, Cohort Retention & Enterprise SLA Ledger
-- Supports Milestone GATE 8: $1,000,000 MRR (5,000 Customers, $200 ARPU, Cohort NRR >= 130%, 99.999% SLA)
-- Cloudflare D1 SQLite standards: Millisecond Unix timestamps, strict CHECK constraints, and random hex UUID defaults.

-- ============================================================================
-- 1. unified_revenue_snapshots
-- Consolidates real-time MRR across all 4 monetization channels:
-- Direct Sales, Affiliate, Content SEO, and Enterprise Deals.
-- Target: $1,000,000 MRR (100,000,000 cents), 5,000 customers, $200 ARPU.
-- ============================================================================
CREATE TABLE IF NOT EXISTS unified_revenue_snapshots (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  snapshot_timestamp INTEGER NOT NULL,
  period_month TEXT NOT NULL, -- Format: 'YYYY-MM'
  direct_sales_cents INTEGER NOT NULL DEFAULT 0,
  affiliate_sales_cents INTEGER NOT NULL DEFAULT 0,
  content_seo_cents INTEGER NOT NULL DEFAULT 0,
  enterprise_deals_cents INTEGER NOT NULL DEFAULT 0,
  total_mrr_cents INTEGER NOT NULL DEFAULT 0,
  active_customers_count INTEGER NOT NULL DEFAULT 0,
  arpu_cents INTEGER NOT NULL DEFAULT 0,
  target_mrr_cents INTEGER NOT NULL DEFAULT 100000000, -- $1,000,000 USD
  target_customers_count INTEGER NOT NULL DEFAULT 5000,
  target_arpu_cents INTEGER NOT NULL DEFAULT 20000, -- $200 USD
  channel_breakdown_json TEXT NOT NULL DEFAULT '{}',
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft', 'active', 'archived', 'reconciled')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_rev_snapshots_period ON unified_revenue_snapshots(period_month, snapshot_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rev_snapshots_total ON unified_revenue_snapshots(total_mrr_cents);

-- ============================================================================
-- 2. cohort_retention_matrix
-- Triangular cohort retention matrix tracking customer and revenue retention over time.
-- Computes Gross Revenue Retention (GRR <= 100%) and Net Revenue Retention (NRR >= 130%).
-- ============================================================================
CREATE TABLE IF NOT EXISTS cohort_retention_matrix (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  cohort_month TEXT NOT NULL, -- Format: 'YYYY-MM' (signup cohort)
  period_offset INTEGER NOT NULL CHECK(period_offset >= 0 AND period_offset <= 24), -- Month 0 to 24
  starting_customers INTEGER NOT NULL,
  retained_customers INTEGER NOT NULL,
  churned_customers INTEGER NOT NULL DEFAULT 0,
  starting_mrr_cents INTEGER NOT NULL,
  retained_base_mrr_cents INTEGER NOT NULL,
  expansion_mrr_cents INTEGER NOT NULL DEFAULT 0,
  contraction_mrr_cents INTEGER NOT NULL DEFAULT 0,
  churned_mrr_cents INTEGER NOT NULL DEFAULT 0,
  ending_mrr_cents INTEGER NOT NULL,
  grr_pct REAL NOT NULL, -- Gross Revenue Retention %: (starting - contraction - churned) / starting * 100
  nrr_pct REAL NOT NULL, -- Net Revenue Retention %: ending / starting * 100 (Target >= 130.0)
  calculated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(cohort_month, period_offset)
);

CREATE INDEX IF NOT EXISTS idx_cohort_matrix_lookup ON cohort_retention_matrix(cohort_month, period_offset);
CREATE INDEX IF NOT EXISTS idx_cohort_matrix_nrr ON cohort_retention_matrix(nrr_pct);

-- ============================================================================
-- 3. enterprise_sla_ledger
-- Tracks 99.999% SLA commitment (Five Nines: max 25.92s downtime/month),
-- error budget consumption, and automated SLA penalty credits.
-- ============================================================================
CREATE TABLE IF NOT EXISTS enterprise_sla_ledger (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  billing_period TEXT NOT NULL, -- Format: 'YYYY-MM'
  target_sla_pct REAL NOT NULL DEFAULT 99.999,
  actual_uptime_pct REAL NOT NULL,
  total_period_seconds INTEGER NOT NULL DEFAULT 2592000, -- 30 days * 86,400s
  downtime_seconds REAL NOT NULL DEFAULT 0.0,
  error_budget_allocated_seconds REAL NOT NULL DEFAULT 25.92,
  error_budget_consumed_seconds REAL NOT NULL DEFAULT 0.0,
  error_budget_remaining_seconds REAL NOT NULL DEFAULT 25.92,
  breach_level TEXT NOT NULL DEFAULT 'none' CHECK(breach_level IN ('none', 'minor', 'moderate', 'critical')),
  penalty_credit_pct REAL NOT NULL DEFAULT 0.0,
  penalty_credit_cents INTEGER NOT NULL DEFAULT 0,
  penalty_status TEXT NOT NULL DEFAULT 'none' CHECK(penalty_status IN ('none', 'pending_approval', 'credited', 'refunded', 'waived')),
  incident_ids_json TEXT NOT NULL DEFAULT '[]',
  evaluated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_sla_ledger_tenant ON enterprise_sla_ledger(tenant_id, billing_period);
CREATE INDEX IF NOT EXISTS idx_sla_ledger_breach ON enterprise_sla_ledger(breach_level, penalty_status);
