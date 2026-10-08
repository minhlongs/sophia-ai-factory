-- Migration 0469: Growth Triad v12 Autonomous Monetization Flywheel
-- Tables for Darwinian performance reseeding, token refresh locking, and conversion attribution ledger

CREATE TABLE IF NOT EXISTS flywheel_reseed_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_job_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  retention_zscore REAL NOT NULL,
  classification TEXT NOT NULL, -- ALPHA_VIRAL, STEADY, STAGNANT
  original_hook TEXT NOT NULL,
  mutated_hooks_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, RESEEDED, SKIPPED, FAILED
  reseeded_campaign_id TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_flywheel_user_status ON flywheel_reseed_jobs (user_id, status);
CREATE INDEX IF NOT EXISTS idx_flywheel_source ON flywheel_reseed_jobs (source_job_id);

CREATE TABLE IF NOT EXISTS conversion_attributions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  video_manifest_id TEXT NOT NULL,
  affiliate_network TEXT NOT NULL, -- CLICKBANK, PAYOS, NOWPAYMENTS, AWIN
  external_order_id TEXT NOT NULL,
  gross_amount_usd REAL NOT NULL,
  commission_amount_usd REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'CONFIRMED', -- PENDING, CONFIRMED, DISPUTED, REFUNDED
  raw_webhook_payload TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attr_user_manifest ON conversion_attributions (user_id, video_manifest_id);
CREATE INDEX IF NOT EXISTS idx_attr_network_order ON conversion_attributions (affiliate_network, external_order_id);
