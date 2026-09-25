-- Migration 0291: Creator Templates & Creator Withdrawal Requests
-- Supports Milestone 2 (R2): Autonomous Creator Marketplace & 70/30 Royalty Revenue-Sharing Protocol

-- 1. Create creator_templates table
CREATE TABLE IF NOT EXISTS creator_templates (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  niche TEXT NOT NULL DEFAULT 'general',
  target_platform TEXT NOT NULL DEFAULT 'tiktok', -- 'tiktok' | 'youtube_shorts' | 'instagram_reels' | 'facebook_reels'
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  hook_style TEXT NOT NULL DEFAULT 'curiosity_gap',
  script_template TEXT NOT NULL,
  storyboard_json TEXT NOT NULL DEFAULT '[]',
  visual_style_prompt TEXT NOT NULL,
  music_prompt TEXT,
  voice_profile TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  royalty_pct REAL NOT NULL DEFAULT 70.0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('draft', 'pending', 'approved', 'rejected', 'archived')),
  quality_score REAL DEFAULT 0.0,
  review_feedback TEXT,
  use_count INTEGER NOT NULL DEFAULT 0,
  rating REAL DEFAULT 0.0,
  review_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (creator_id) REFERENCES creator_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_creator_templates_creator ON creator_templates(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_creator_templates_niche_status ON creator_templates(niche, status, rating DESC);
CREATE INDEX IF NOT EXISTS idx_creator_templates_platform ON creator_templates(target_platform, status);
CREATE INDEX IF NOT EXISTS idx_creator_templates_tenant ON creator_templates(tenant_id);

-- 2. Extend creator_profiles with VietQR banking fields and payout_rail
ALTER TABLE creator_profiles ADD COLUMN payout_rail TEXT DEFAULT 'USDT' CHECK (payout_rail IN ('USDT', 'VIETQR'));
ALTER TABLE creator_profiles ADD COLUMN bank_bin TEXT;
ALTER TABLE creator_profiles ADD COLUMN bank_account_number TEXT;
ALTER TABLE creator_profiles ADD COLUMN bank_account_name TEXT;

-- 3. Create creator_withdrawal_requests table
CREATE TABLE IF NOT EXISTS creator_withdrawal_requests (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  rail TEXT NOT NULL CHECK (rail IN ('USDT', 'VIETQR')),
  destination_address TEXT,
  bank_bin TEXT,
  bank_account_number TEXT,
  bank_account_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'cancelled')),
  tx_hash TEXT,
  admin_notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (creator_id) REFERENCES creator_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_creator_withdrawals_creator ON creator_withdrawal_requests(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_creator_withdrawals_status ON creator_withdrawal_requests(status, created_at ASC);
