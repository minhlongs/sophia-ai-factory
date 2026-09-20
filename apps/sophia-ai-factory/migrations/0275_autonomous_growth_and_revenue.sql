-- Migration: 0275_autonomous_growth_and_revenue
-- Phase 17: Creator Marketplace, Royalty Attribution, and Autonomous Growth Engine
-- Follows sequentially after 0274_playbook_campaign_intelligence.sql

-- ============================================================================
-- 1. EXTEND campaign_blueprints WITH MARKETPLACE & REMIX METADATA
-- ============================================================================

ALTER TABLE campaign_blueprints ADD COLUMN creator_id TEXT;
ALTER TABLE campaign_blueprints ADD COLUMN title TEXT;
ALTER TABLE campaign_blueprints ADD COLUMN description TEXT;
ALTER TABLE campaign_blueprints ADD COLUMN niche TEXT NOT NULL DEFAULT 'general';
ALTER TABLE campaign_blueprints ADD COLUMN video_recipe_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE campaign_blueprints ADD COLUMN conversion_rate REAL DEFAULT 0.05;
ALTER TABLE campaign_blueprints ADD COLUMN remix_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campaign_blueprints ADD COLUMN royalty_pct REAL NOT NULL DEFAULT 10.0;
ALTER TABLE campaign_blueprints ADD COLUMN marketplace_listed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campaign_blueprints ADD COLUMN parent_blueprint_id TEXT;
ALTER TABLE campaign_blueprints ADD COLUMN status TEXT NOT NULL DEFAULT 'generated';
ALTER TABLE campaign_blueprints ADD COLUMN confidence REAL NOT NULL DEFAULT 0.8;
ALTER TABLE campaign_blueprints ADD COLUMN estimated_cost_cents INTEGER NOT NULL DEFAULT 50;
ALTER TABLE campaign_blueprints ADD COLUMN estimated_duration_seconds INTEGER NOT NULL DEFAULT 30;
ALTER TABLE campaign_blueprints ADD COLUMN aspect_ratios TEXT NOT NULL DEFAULT '["9:16"]';

CREATE INDEX IF NOT EXISTS idx_blueprints_marketplace 
  ON campaign_blueprints(marketplace_listed, niche, conversion_rate DESC);

CREATE INDEX IF NOT EXISTS idx_blueprints_platform 
  ON campaign_blueprints(marketplace_listed, target_platform, conversion_rate DESC);

CREATE INDEX IF NOT EXISTS idx_blueprints_creator 
  ON campaign_blueprints(creator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blueprints_parent 
  ON campaign_blueprints(parent_blueprint_id);

-- ============================================================================
-- 2. EXTEND creative_missions WITH BLUEPRINT REFERENCE
-- ============================================================================

ALTER TABLE creative_missions ADD COLUMN blueprint_id TEXT REFERENCES campaign_blueprints(id);

CREATE INDEX IF NOT EXISTS idx_creative_missions_blueprint 
  ON creative_missions(blueprint_id);

-- ============================================================================
-- 3. BLUEPRINT REMIXES TABLE (Derivative Lineage & Provenance Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS blueprint_remixes (
  id TEXT PRIMARY KEY,
  blueprint_id TEXT NOT NULL REFERENCES campaign_blueprints(id),
  parent_blueprint_id TEXT REFERENCES campaign_blueprints(id),
  creator_id TEXT NOT NULL,                         -- Parent/root creator receiving royalty
  remixer_user_id TEXT NOT NULL,                    -- Remixer who cloned the template
  remixer_id TEXT,                                  -- Alias for test harness compatibility
  remixer_workspace_id TEXT,                        -- Workspace executing derivative mission
  mission_id TEXT NOT NULL,                         -- Downstream creative mission created
  remix_params_json TEXT NOT NULL DEFAULT '{}',     -- Overrides (voice, hook, visual style)
  royalty_cents INTEGER NOT NULL DEFAULT 0,         -- Snapshot royalty share
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_remixes_blueprint 
  ON blueprint_remixes(blueprint_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_remixes_creator 
  ON blueprint_remixes(creator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_remixes_user 
  ON blueprint_remixes(remixer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_remixes_mission 
  ON blueprint_remixes(mission_id);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_remixes_mission_blueprint 
  ON blueprint_remixes(mission_id, blueprint_id);

-- ============================================================================
-- 4. CREATOR ROYALTIES TABLE (Downstream Conversion Monetization Events)
-- ============================================================================

CREATE TABLE IF NOT EXISTS creator_royalties (
  id TEXT PRIMARY KEY,
  blueprint_id TEXT NOT NULL REFERENCES campaign_blueprints(id),
  creator_id TEXT NOT NULL,                         -- Creator entitled to the royalty
  remixer_user_id TEXT,                             -- User whose remix produced conversion
  downstream_conversion_id TEXT NOT NULL,           -- Unique identifier of conversion event
  amount_cents INTEGER NOT NULL,                    -- Net royalty amount accrued to creator
  conversion_amount_cents INTEGER NOT NULL DEFAULT 0, -- Gross order/conversion revenue
  royalty_pct REAL NOT NULL,                        -- Royalty percentage applied
  currency TEXT NOT NULL DEFAULT 'USD',             -- 'USD' | 'USDT'
  lineage_tier TEXT NOT NULL DEFAULT 'root',        -- 'root' | 'parent'
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK(status IN ('pending', 'payable', 'paying', 'paid', 'clawed_back')),
  payable_at INTEGER NOT NULL DEFAULT 0,            -- Unix ms timestamp when anti-fraud hold expires
  paid_at INTEGER,                                  -- Unix ms timestamp when payout settled
  payout_batch_id TEXT,                             -- Link to batch payout row
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(blueprint_id, creator_id, downstream_conversion_id)
);

CREATE INDEX IF NOT EXISTS idx_royalties_creator_status 
  ON creator_royalties(creator_id, status, payable_at ASC);

CREATE INDEX IF NOT EXISTS idx_royalties_conversion 
  ON creator_royalties(downstream_conversion_id);

CREATE INDEX IF NOT EXISTS idx_royalties_batch 
  ON creator_royalties(payout_batch_id);

-- ============================================================================
-- 5. CREATOR EARNINGS LEDGER TABLE (Immutable, Dual-Entry Financial Journal)
-- ============================================================================

CREATE TABLE IF NOT EXISTS creator_earnings_ledger (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,                    -- Positive for earnings, negative for clawbacks
  currency TEXT NOT NULL DEFAULT 'USD',             -- 'USD' | 'USDT'
  event_type TEXT NOT NULL DEFAULT 'royalty_accrual', -- 'royalty_accrual' | 'royalty_payout' | 'royalty_clawback' | 'adjustment'
  source_type TEXT NOT NULL DEFAULT 'blueprint_remix', -- 'blueprint_remix' | 'affiliate_direct'
  reference_id TEXT NOT NULL,                       -- remix_id, conversion_id, or payout_batch_id
  balance_after_cents INTEGER NOT NULL DEFAULT 0,   -- Balance snapshot after entry
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK(status IN ('pending', 'payable', 'paid', 'clawed_back')),
  sequence_num INTEGER NOT NULL DEFAULT 1,          -- Monotonic per-creator sequence for OCC CAS
  metadata_json TEXT NOT NULL DEFAULT '{}',         -- Audit trail metadata
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(creator_id, reference_id, event_type),     -- Idempotency constraint
  UNIQUE(creator_id, sequence_num)                  -- OCC CAS concurrency protection constraint
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_creator_ledger_seq 
  ON creator_earnings_ledger(creator_id, sequence_num);

CREATE INDEX IF NOT EXISTS idx_creator_ledger_creator 
  ON creator_earnings_ledger(creator_id, created_at DESC, sequence_num DESC);

CREATE INDEX IF NOT EXISTS idx_creator_ledger_reference 
  ON creator_earnings_ledger(reference_id);

CREATE INDEX IF NOT EXISTS idx_creator_ledger_status 
  ON creator_earnings_ledger(creator_id, status);

-- ============================================================================
-- 6. SUPPORTING TABLES (Commission Ledger, Payout Batches, Edge Nodes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS commission_ledger (
  id TEXT PRIMARY KEY,
  affiliate_id TEXT NOT NULL,
  network TEXT NOT NULL,
  external_conversion_id TEXT NOT NULL,
  sub_id TEXT,
  order_value_cents INTEGER NOT NULL DEFAULT 0,
  commission_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'payable', 'paying', 'paid', 'clawback')),
  hold_days INTEGER NOT NULL DEFAULT 14,
  attributed_at INTEGER NOT NULL,
  payable_at INTEGER NOT NULL,
  payout_batch_id TEXT,
  parent_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  UNIQUE(network, external_conversion_id)
);

CREATE INDEX IF NOT EXISTS idx_commission_status_payable 
  ON commission_ledger(status, payable_at ASC);

CREATE TABLE IF NOT EXISTS payout_batches (
  id TEXT PRIMARY KEY,
  rail TEXT NOT NULL,                               -- 'nowpayments_usdt' | 'stripe_connect'
  total_amount_cents INTEGER NOT NULL DEFAULT 0,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'confirmed', 'reconciliation_failed')),
  tx_hash TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  confirmed_at INTEGER
);

CREATE TABLE IF NOT EXISTS edge_nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tunnel_url TEXT NOT NULL,
  bearer_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ONLINE' CHECK(status IN ('ONLINE', 'OFFLINE', 'DEGRADED')),
  hardware_profile TEXT NOT NULL DEFAULT 'apple_m1_max',
  cost_kind TEXT NOT NULL DEFAULT 'unmetered',
  last_heartbeat_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE TABLE IF NOT EXISTS edge_node_heartbeats (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES edge_nodes(id),
  status TEXT NOT NULL,
  latency_ms REAL NOT NULL DEFAULT 10.0,
  recorded_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);
