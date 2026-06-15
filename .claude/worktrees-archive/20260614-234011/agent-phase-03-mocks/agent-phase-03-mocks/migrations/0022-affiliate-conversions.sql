-- Migration: 0022-affiliate-conversions
-- ClickBank INS conversion tracking with 70/30 commission split

CREATE TABLE IF NOT EXISTS affiliate_conversions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  receipt TEXT NOT NULL,                   -- ClickBank txn ID
  click_id TEXT,                           -- FK to affiliate_clicks.click_id (NULL if unattributed)
  campaign_id TEXT REFERENCES campaigns(id),
  user_id TEXT REFERENCES users(id),
  offer_id TEXT,
  network TEXT NOT NULL DEFAULT 'clickbank',
  event_type TEXT NOT NULL CHECK (event_type IN ('SALE','REFUND','CHARGEBACK','TEST')),
  gross_amount REAL NOT NULL,              -- merchant-net commission ClickBank reports
  currency TEXT NOT NULL DEFAULT 'USD',
  commission_user REAL NOT NULL,           -- 70% of gross_amount
  commission_sophia REAL NOT NULL,         -- 30% of gross_amount
  payout_status TEXT NOT NULL DEFAULT 'pending_clearance'
    CHECK (payout_status IN ('pending_clearance','available','paid','reversed','unattributed')),
  available_at INTEGER,                    -- Unix seconds: ts + 60 days for SALE
  paid_at INTEGER,                         -- Set when admin marks paid (M5)
  payout_id TEXT,                          -- Reference to payout batch (M5)
  raw_payload TEXT,                        -- Full INS payload for audit
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(receipt, event_type)              -- idempotency
);

CREATE INDEX IF NOT EXISTS idx_conv_user ON affiliate_conversions(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_campaign ON affiliate_conversions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_conv_click ON affiliate_conversions(click_id);
CREATE INDEX IF NOT EXISTS idx_conv_payout ON affiliate_conversions(payout_status, available_at);
CREATE INDEX IF NOT EXISTS idx_conv_created ON affiliate_conversions(created_at DESC);
