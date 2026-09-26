-- Migration 0298: Creator Reviews & Marketplace Extensions
-- Pillar R1: Creator Marketplace Scaling & 70/30 Royalty Smart Ledger

CREATE TABLE IF NOT EXISTS creator_reviews (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  rating REAL NOT NULL CHECK(rating >= 1.0 AND rating <= 5.0),
  review_text TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (template_id) REFERENCES creator_templates(id),
  UNIQUE(template_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_creator_reviews_template ON creator_reviews(template_id, rating DESC);
CREATE INDEX IF NOT EXISTS idx_creator_reviews_user ON creator_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_reviews_tenant ON creator_reviews(tenant_id);
