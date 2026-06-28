-- Migration 0047: add 'underpaid' status to user_purchases
-- P0.4 fix: IPN underpayment detection needs a new terminal status.
-- 'underpaid' means actually_paid < price_amount * 0.99 (1% tolerance).
-- Row is NOT fulfilled; customer must contact support or pay difference.

-- SQLite CHECK constraints cannot be altered after creation; we drop and recreate
-- the constraint via a new table + data migration approach.
-- Safer alternative: just allow the status column to hold 'underpaid' by removing
-- the old CHECK and adding a new one.

-- Step 1: Rename existing table to temp
ALTER TABLE user_purchases RENAME TO user_purchases_old;

-- Step 2: Recreate with updated CHECK constraint
CREATE TABLE user_purchases (
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
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'refunded', 'failed', 'underpaid')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  paid_at INTEGER,
  refunded_at INTEGER,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Step 3: Copy data
INSERT INTO user_purchases
SELECT * FROM user_purchases_old;

-- Step 4: Drop old table
DROP TABLE user_purchases_old;

-- Step 5: Restore indexes
CREATE INDEX IF NOT EXISTS idx_user_purchases_user_kind
  ON user_purchases (user_id, kind, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_purchases_payment_id
  ON user_purchases (payment_id);

CREATE INDEX IF NOT EXISTS idx_user_purchases_user_id
  ON user_purchases (user_id);
