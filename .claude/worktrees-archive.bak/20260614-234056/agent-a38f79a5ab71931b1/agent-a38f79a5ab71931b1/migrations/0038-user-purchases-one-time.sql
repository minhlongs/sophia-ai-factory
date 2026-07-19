-- Migration 0038: user_purchases table for one-time bundle purchases
-- Stores both subscription renewals and one-time bundle payments with kind discriminator
-- payment_id UNIQUE ensures IPN idempotency

CREATE TABLE IF NOT EXISTS user_purchases (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('subscription', 'one_time')),
  sku TEXT NOT NULL,
  payment_id TEXT NOT NULL UNIQUE,
  invoice_id TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  credits_total INTEGER NOT NULL DEFAULT 0,
  credits_remaining INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refunded', 'failed')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  paid_at INTEGER,
  refunded_at INTEGER,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_user_purchases_user_kind
  ON user_purchases (user_id, kind, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_purchases_payment_id
  ON user_purchases (payment_id);

CREATE INDEX IF NOT EXISTS idx_user_purchases_user_id
  ON user_purchases (user_id);
