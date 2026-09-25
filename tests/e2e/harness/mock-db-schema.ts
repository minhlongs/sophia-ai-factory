/**
 * D1 SQLite Schema for Sophia AI Factory E2E Testing
 *
 * Models database tables across:
 * - R1: Video Dubbing & Subtitles
 * - R2: Creator Marketplace & 70/30 Royalty Protocol (Migration 0291)
 * - R3: Multi-Platform Syndication & Peak-Time Scheduling
 * - R4: Edge CDN & Adaptive HLS Streaming
 */

export const E2E_D1_SCHEMA = `
-- Video assets and transcription
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  r2_key TEXT,
  duration_sec REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'uploaded',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS video_subtitles (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  format TEXT NOT NULL, -- 'srt' | 'vtt'
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS video_audio_tracks (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  preset_id TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

-- Creator Marketplace & Royalties (Migration 0291)
CREATE TABLE IF NOT EXISTS creator_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  handle TEXT UNIQUE NOT NULL,
  bio TEXT,
  payout_rail TEXT NOT NULL DEFAULT 'USDT', -- 'USDT' | 'VIETQR'
  payout_destination TEXT, -- USDT address or VietQR bank:account
  accumulated_earnings_cents INTEGER NOT NULL DEFAULT 0,
  available_balance_cents INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS creator_templates (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  niche TEXT NOT NULL,
  script_template TEXT NOT NULL,
  storyboard_json TEXT NOT NULL,
  visual_style_prompt TEXT NOT NULL,
  background_music_url TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  royalty_percent REAL NOT NULL DEFAULT 70.0,
  status TEXT NOT NULL DEFAULT 'pending', -- 'draft' | 'pending' | 'approved' | 'rejected' | 'archived'
  rating_avg REAL NOT NULL DEFAULT 0.0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (creator_id) REFERENCES creator_profiles(id)
);

CREATE TABLE IF NOT EXISTS creator_template_ratings (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  has_remixed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(template_id, user_id),
  FOREIGN KEY (template_id) REFERENCES creator_templates(id)
);

CREATE TABLE IF NOT EXISTS campaign_blueprints (
  id TEXT PRIMARY KEY,
  creator_id TEXT,
  parent_blueprint_id TEXT,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS creator_earnings_ledger (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  event_type TEXT NOT NULL DEFAULT 'royalty_accrual',
  source_type TEXT NOT NULL DEFAULT 'template_activation',
  reference_id TEXT NOT NULL,
  balance_after_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  sequence_num INTEGER NOT NULL DEFAULT 1,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT 0,
  UNIQUE(creator_id, reference_id, event_type),
  UNIQUE(creator_id, sequence_num)
);

CREATE TABLE IF NOT EXISTS creator_withdrawal_requests (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  rail TEXT NOT NULL, -- 'USDT' | 'VIETQR'
  destination TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'completed' | 'rejected'
  rejection_reason TEXT,
  tx_hash TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY (creator_id) REFERENCES creator_profiles(id)
);

-- Syndication & Scheduling
CREATE TABLE IF NOT EXISTS publishing_channels (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'youtube_shorts' | 'tiktok' | 'instagram_reels' | 'facebook_reels'
  channel_name TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'expired' | 'revoked'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS publishing_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  market TEXT NOT NULL, -- 'hanoi' | 'tokyo' | 'bangkok' | 'seoul' | 'singapore'
  scheduled_at INTEGER NOT NULL, -- Unix timestamp seconds
  status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled' | 'publishing' | 'published' | 'failed' | 'deferred'
  platform_post_id TEXT,
  metadata_json TEXT NOT NULL,
  error_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (channel_id) REFERENCES publishing_channels(id)
);

CREATE TABLE IF NOT EXISTS channel_cooldowns (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  cooldown_until INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Streaming & Signed Downloads
CREATE TABLE IF NOT EXISTS video_streams (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  quality TEXT NOT NULL, -- '1080p' | '720p' | '480p'
  bandwidth INTEGER NOT NULL,
  playlist_url TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS signed_download_logs (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  signature TEXT NOT NULL,
  downloaded_at INTEGER,
  created_at INTEGER NOT NULL
);
`;
