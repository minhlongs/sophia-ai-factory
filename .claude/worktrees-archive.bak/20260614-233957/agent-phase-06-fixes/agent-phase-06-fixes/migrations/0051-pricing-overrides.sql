-- Migration 0051: pricing_overrides table
-- Allows admin to override SKU prices without code changes.

CREATE TABLE IF NOT EXISTS pricing_overrides (
  sku TEXT PRIMARY KEY,
  price_cents INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  metadata TEXT,  -- JSON: {"label_vi":"...", "label_en":"..."}
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_by_user_id TEXT
);
