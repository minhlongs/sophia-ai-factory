-- Add first_customer flag to subscriptions for offline/cash payment tracking
-- FREE100 promo + first customer manual payment flow

ALTER TABLE subscriptions ADD COLUMN first_customer BOOLEAN DEFAULT 0;

-- Index for finding first customer quickly
CREATE INDEX IF NOT EXISTS idx_subscriptions_first_customer ON subscriptions(first_customer) WHERE first_customer = 1;
