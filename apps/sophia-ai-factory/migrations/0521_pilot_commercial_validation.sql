-- CUSTOMER-01: Commercial Validation Extension (Isolated `sophia-pilot-db` ONLY)
-- Supports:
-- 1. Verified CTA & Affiliate Shortlinks (`pilot_affiliate_links`) + IP-hashed `SERVER_VERIFIED_CLICK` (`pilot_affiliate_clicks`)
-- 2. Verifiable MP4 Video Export Receipts (`pilot_mp4_exports`: 1-Key Browser H.264 MP4 & Optional HeyGen BYOK)
-- 3. Manual Publish & Honest Affiliate Reconciliation (`pilot_manual_publishes`: zero auto-publish, zero fabricated conversions)

CREATE TABLE IF NOT EXISTS pilot_affiliate_links (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  artifact_id TEXT,
  short_code TEXT NOT NULL UNIQUE,
  destination_url TEXT NOT NULL,
  cta_text TEXT NOT NULL,
  network_hint TEXT NOT NULL DEFAULT 'generic',
  sub_id TEXT NOT NULL,
  disclosure_tag TEXT NOT NULL DEFAULT '#QuảngCáo',
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pilot_affiliate_links_org_user
  ON pilot_affiliate_links (org_id, user_id, created_at_iso DESC);

CREATE TABLE IF NOT EXISTS pilot_affiliate_clicks (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  short_code TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  country_code TEXT,
  referrer_host TEXT,
  provenance TEXT NOT NULL DEFAULT 'SERVER_VERIFIED_CLICK',
  clicked_at_iso TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pilot_affiliate_clicks_link
  ON pilot_affiliate_clicks (link_id, clicked_at_iso DESC);

CREATE INDEX IF NOT EXISTS idx_pilot_affiliate_clicks_org_user
  ON pilot_affiliate_clicks (org_id, user_id, clicked_at_iso DESC);

CREATE TABLE IF NOT EXISTS pilot_mp4_exports (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  render_mode TEXT NOT NULL CHECK (render_mode IN ('browser_h264_mp4', 'heygen_byok_mp4')),
  heygen_job_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  sha256_hex TEXT,
  byte_size INTEGER,
  duration_sec REAL,
  width INTEGER,
  height INTEGER,
  codec TEXT NOT NULL DEFAULT 'h264',
  container_brand TEXT NOT NULL DEFAULT 'isom',
  cta_text TEXT NOT NULL,
  short_code TEXT NOT NULL,
  referral_url TEXT NOT NULL,
  provider_video_url TEXT,
  error_code TEXT,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pilot_mp4_exports_org_user
  ON pilot_mp4_exports (org_id, user_id, created_at_iso DESC);

CREATE TABLE IF NOT EXISTS pilot_manual_publishes (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  artifact_id TEXT,
  mp4_export_id TEXT,
  link_id TEXT,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'youtube_shorts', 'instagram_reels', 'facebook_reels', 'other')),
  published_post_url TEXT NOT NULL,
  reported_views INTEGER,
  reported_conversions INTEGER,
  reported_commission_amount REAL,
  reported_commission_currency TEXT,
  evidence_note TEXT,
  provenance TEXT NOT NULL DEFAULT 'CUSTOMER_SELF_REPORTED',
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL,
  UNIQUE (org_id, user_id, published_post_url)
);

CREATE INDEX IF NOT EXISTS idx_pilot_manual_publishes_org_user
  ON pilot_manual_publishes (org_id, user_id, updated_at_iso DESC);
