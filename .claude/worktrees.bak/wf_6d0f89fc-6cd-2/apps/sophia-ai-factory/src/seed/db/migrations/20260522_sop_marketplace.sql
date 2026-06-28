-- Migration 20260522: SOP Marketplace — Listings + Licenses
-- Depends on: sop_templates table (existing)

-- SOP Marketplace Listings (extends sop_templates with pricing metadata)
CREATE TABLE IF NOT EXISTS sop_listings (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL UNIQUE,
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  preview_md TEXT,
  demo_video_url TEXT,
  tags TEXT,
  total_sales INTEGER DEFAULT 0,
  total_revenue_cents INTEGER DEFAULT 0,
  rating_avg REAL DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  status TEXT CHECK(status IN ('pending_review','published','rejected','suspended')) NOT NULL DEFAULT 'pending_review',
  rejection_reason TEXT,
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- SOP Purchase Licenses (per user × template)
CREATE TABLE IF NOT EXISTS sop_licenses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  payment_id TEXT,
  payment_status TEXT CHECK(payment_status IN ('pending','paid','refunded')) NOT NULL DEFAULT 'pending',
  purchased_at INTEGER NOT NULL,
  refunded_at INTEGER,
  UNIQUE(user_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_listing_status ON sop_listings(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_template ON sop_listings(template_id);
CREATE INDEX IF NOT EXISTS idx_license_user ON sop_licenses(user_id, template_id);
CREATE INDEX IF NOT EXISTS idx_license_listing ON sop_licenses(listing_id, payment_status);
