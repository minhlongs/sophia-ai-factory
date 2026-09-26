-- Migration 0299: Enterprise Reseller Federation & Co-Op Engine
-- Supports Milestone M1 & M2: Global Partner Channels, Master Agency Cascade Overrides, Bulk License Pools & Co-Op Funds
-- Strict Cloudflare D1 SQLite standards: Millisecond Unix timestamps, integer cents, robust indexes and check constraints.

-- ============================================================================
-- 1. partner_organizations
-- Description: Enterprise partner entity representing Master Agencies & Resellers.
-- ============================================================================
CREATE TABLE IF NOT EXISTS partner_organizations (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  organization_type TEXT NOT NULL CHECK(organization_type IN ('master_agency', 'sub_agency', 'standard_partner', 'enterprise_reseller')),
  tier TEXT NOT NULL DEFAULT 'SILVER' CHECK(tier IN ('SILVER', 'GOLD', 'PLATINUM')),
  cascade_override_pct REAL NOT NULL DEFAULT 5.0,
  billing_email TEXT NOT NULL,
  custom_domain TEXT UNIQUE,
  whitelabel_config_json TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'pending', 'pending_approval')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (partner_id) REFERENCES partner_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_partner_orgs_partner ON partner_organizations(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_orgs_tenant ON partner_organizations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_partner_orgs_type ON partner_organizations(organization_type);
CREATE INDEX IF NOT EXISTS idx_partner_orgs_status ON partner_organizations(status);
CREATE INDEX IF NOT EXISTS idx_partner_orgs_slug ON partner_organizations(slug);

-- ============================================================================
-- 2. partner_sub_resellers
-- Description: Hierarchy binding Master Agency -> Sub-Agency with 5% override.
-- ============================================================================
CREATE TABLE IF NOT EXISTS partner_sub_resellers (
  id TEXT PRIMARY KEY,
  master_partner_id TEXT NOT NULL,
  sub_partner_id TEXT NOT NULL UNIQUE,
  agreement_ref TEXT,
  override_rate_pct REAL NOT NULL DEFAULT 5.0,
  lifetime_override_cents INTEGER NOT NULL DEFAULT 0,
  pending_override_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'terminated', 'paused')),
  joined_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (master_partner_id) REFERENCES partner_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (sub_partner_id) REFERENCES partner_profiles(id) ON DELETE CASCADE,
  CHECK(master_partner_id != sub_partner_id)
);

CREATE INDEX IF NOT EXISTS idx_sub_resellers_master ON partner_sub_resellers(master_partner_id, status);
CREATE INDEX IF NOT EXISTS idx_sub_resellers_sub ON partner_sub_resellers(sub_partner_id);

-- ============================================================================
-- 3. partner_license_pools
-- Description: Bulk client seat & MCU compute quota pooling for reseller federation.
-- ============================================================================
CREATE TABLE IF NOT EXISTS partner_license_pools (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL,
  pool_name TEXT NOT NULL,
  total_seats INTEGER NOT NULL DEFAULT 0,
  allocated_seats INTEGER NOT NULL DEFAULT 0,
  total_mcu_credits INTEGER NOT NULL DEFAULT 0,
  allocated_mcu_credits INTEGER NOT NULL DEFAULT 0,
  consumed_mcu_credits INTEGER NOT NULL DEFAULT 0,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  auto_topup_enabled INTEGER NOT NULL DEFAULT 0,
  auto_topup_threshold_mcu INTEGER DEFAULT 0,
  auto_topup_amount_mcu INTEGER DEFAULT 0,
  period_start INTEGER,
  period_end INTEGER,
  auto_renew INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'exhausted', 'expired', 'revoked')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (partner_id) REFERENCES partner_profiles(id) ON DELETE CASCADE,
  CHECK(allocated_seats <= total_seats),
  CHECK(allocated_mcu_credits <= total_mcu_credits),
  CHECK(consumed_mcu_credits <= allocated_mcu_credits)
);

CREATE INDEX IF NOT EXISTS idx_license_pools_partner ON partner_license_pools(partner_id, status);

-- ============================================================================
-- 4. partner_payout_batches
-- Description: Batch settlement log for automated USDT / PayOS transfers.
-- ============================================================================
CREATE TABLE IF NOT EXISTS partner_payout_batches (
  id TEXT PRIMARY KEY,
  partner_id TEXT,
  batch_type TEXT NOT NULL CHECK(batch_type IN ('commission', 'co_op_reimbursement', 'hybrid')),
  payout_rail TEXT NOT NULL CHECK(payout_rail IN ('USDT', 'VIETQR', 'BANK_WIRE')),
  total_amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency IN ('USD', 'VND', 'USDT')),
  total_amount_local INTEGER NOT NULL DEFAULT 0,
  fx_rate REAL NOT NULL DEFAULT 1.0,
  item_count INTEGER NOT NULL DEFAULT 0,
  destination_address TEXT,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  external_reference TEXT,
  raw_response_json TEXT DEFAULT '{}',
  error_message TEXT,
  executed_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_payout_batches_status ON partner_payout_batches(status);
CREATE INDEX IF NOT EXISTS idx_payout_batches_rail ON partner_payout_batches(payout_rail, status);
CREATE INDEX IF NOT EXISTS idx_payout_batches_created ON partner_payout_batches(created_at DESC);

-- ============================================================================
-- 5. co_op_budget_allocations
-- Description: Monthly 5% gross MRR tranches set aside for Gold & Platinum partners.
-- ============================================================================
CREATE TABLE IF NOT EXISTS co_op_budget_allocations (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL,
  billing_cycle_month TEXT NOT NULL, -- e.g. '2026-09'
  tier_at_time TEXT NOT NULL CHECK(tier_at_time IN ('GOLD', 'PLATINUM')),
  mrr_basis_cents INTEGER NOT NULL,
  accrual_rate_pct REAL NOT NULL DEFAULT 5.0,
  allocated_cents INTEGER NOT NULL,
  claimed_cents INTEGER NOT NULL DEFAULT 0,
  remaining_cents INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'exhausted', 'expired', 'locked', 'closed')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (partner_id) REFERENCES partner_profiles(id) ON DELETE CASCADE,
  UNIQUE(partner_id, billing_cycle_month),
  CHECK(claimed_cents <= allocated_cents)
);

CREATE INDEX IF NOT EXISTS idx_budget_alloc_partner ON co_op_budget_allocations(partner_id, status);
CREATE INDEX IF NOT EXISTS idx_budget_alloc_cycle ON co_op_budget_allocations(billing_cycle_month);

-- ============================================================================
-- 6. partner_co_op_claims
-- Description: Marketing reimbursement claims and automated appraisal records.
-- ============================================================================
CREATE TABLE IF NOT EXISTS partner_co_op_claims (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL,
  budget_allocation_id TEXT,
  campaign_name TEXT NOT NULL,
  claim_type TEXT NOT NULL CHECK(claim_type IN ('paid_ads', 'influencer_sponsorship', 'offline_event', 'creative_production', 'co_branded_content', 'digital_ads', 'event_sponsorship', 'content_creation', 'webinar', 'print_media', 'other')),
  invoice_number TEXT NOT NULL,
  invoice_url TEXT NOT NULL,
  invoice_date INTEGER NOT NULL,
  requested_amount_cents INTEGER NOT NULL,
  approved_amount_cents INTEGER NOT NULL DEFAULT 0,
  reimbursement_currency TEXT NOT NULL DEFAULT 'USDT' CHECK(reimbursement_currency IN ('USDT', 'VND')),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted', 'under_review', 'approved', 'rejected', 'processing', 'paid', 'disbursed', 'cancelled')),
  audit_score REAL DEFAULT 0.0,
  audit_notes_json TEXT DEFAULT '{}',
  rejection_reason TEXT,
  payout_batch_id TEXT,
  reviewed_by TEXT,
  reviewed_at INTEGER,
  paid_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (partner_id) REFERENCES partner_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (budget_allocation_id) REFERENCES co_op_budget_allocations(id),
  FOREIGN KEY (payout_batch_id) REFERENCES partner_payout_batches(id)
);

CREATE INDEX IF NOT EXISTS idx_coop_claims_partner ON partner_co_op_claims(partner_id, status);
CREATE INDEX IF NOT EXISTS idx_coop_claims_batch ON partner_co_op_claims(payout_batch_id);
CREATE INDEX IF NOT EXISTS idx_coop_claims_status ON partner_co_op_claims(status);
