-- Migration: 0286_agency_multitenancy_subaccounts.sql
-- Milestone 2 / Phase 18 Scale: Self-Service Agency Workspace & Client Sub-Accounts with Video Review Portal
-- Sequentially follows 0285_affiliate_vietqr_payout_rail.sql

PRAGMA foreign_keys = ON;
PRAGMA defer_foreign_keys = ON;

-- ============================================================================
-- 1. TABLE: client_subaccounts
-- Description: Isolated sub-spaces provisioned by an Agency Organization for each client brand.
-- ============================================================================
CREATE TABLE IF NOT EXISTS client_subaccounts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  agency_org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  custom_domain TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (lower(status) IN ('active', 'suspended', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (agency_org_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_client_subaccounts_agency_org ON client_subaccounts(agency_org_id);
CREATE INDEX IF NOT EXISTS idx_client_subaccounts_status ON client_subaccounts(status);
CREATE INDEX IF NOT EXISTS idx_client_subaccounts_custom_domain ON client_subaccounts(custom_domain) WHERE custom_domain IS NOT NULL;

-- ============================================================================
-- 2. TABLE: subaccount_branding
-- Description: Whitelabel branding per client subaccount (logo, brand palette).
-- ============================================================================
CREATE TABLE IF NOT EXISTS subaccount_branding (
  subaccount_id TEXT PRIMARY KEY REFERENCES client_subaccounts(id) ON DELETE CASCADE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#0f172a',
  accent_color TEXT DEFAULT '#10b981',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- 3. TABLE: subaccount_mcu_allocations
-- Description: Dedicated Model Compute Unit (MCU) quota budgeted from agency pool.
-- ============================================================================
CREATE TABLE IF NOT EXISTS subaccount_mcu_allocations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  subaccount_id TEXT NOT NULL REFERENCES client_subaccounts(id) ON DELETE CASCADE,
  allocated_mcu INTEGER NOT NULL DEFAULT 0,
  used_mcu INTEGER NOT NULL DEFAULT 0,
  period_start TEXT,
  period_end TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (subaccount_id)
);

CREATE INDEX IF NOT EXISTS idx_subaccount_mcu_allocations_subaccount ON subaccount_mcu_allocations(subaccount_id);

-- ============================================================================
-- 4. TABLE: subaccount_members
-- Description: Scoped role-based access control per client subaccount.
-- ============================================================================
CREATE TABLE IF NOT EXISTS subaccount_members (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  subaccount_id TEXT NOT NULL REFERENCES client_subaccounts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (lower(role) IN ('agency_owner', 'video_editor', 'client_reviewer')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (subaccount_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_subaccount_members_user ON subaccount_members(user_id);
CREATE INDEX IF NOT EXISTS idx_subaccount_members_subaccount ON subaccount_members(subaccount_id);

-- ============================================================================
-- 5. TABLE: video_reviews
-- Description: Cryptographic tokenized review links, feedback notes & approval state.
-- ============================================================================
CREATE TABLE IF NOT EXISTS video_reviews (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  subaccount_id TEXT NOT NULL REFERENCES client_subaccounts(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  video_title TEXT,
  video_url TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (lower(status) IN ('pending', 'approved', 'changes_requested')),
  feedback_comments TEXT NOT NULL DEFAULT '[]',
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_video_reviews_token_hash ON video_reviews(token_hash);
CREATE INDEX IF NOT EXISTS idx_video_reviews_subaccount ON video_reviews(subaccount_id);
CREATE INDEX IF NOT EXISTS idx_video_reviews_video ON video_reviews(video_id);
CREATE INDEX IF NOT EXISTS idx_video_reviews_status ON video_reviews(status);
