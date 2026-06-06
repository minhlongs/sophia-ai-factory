-- Add first_customer flag to subscriptions for offline/cash payment tracking
-- FREE100 promo + first customer manual payment flow

-- SQLite-compatible: no IF NOT EXISTS in ALTER TABLE
ALTER TABLE subscriptions ADD COLUMN first_customer BOOLEAN DEFAULT 0;

-- SQLite-compatible: no partial index WHERE clause
CREATE INDEX IF NOT EXISTS idx_subscriptions_first_customer ON subscriptions(first_customer);
