-- 0499_byok_key_policy_and_publish_ledger.sql
-- Records the BYOK key policy the capability gate reads, and the ledger of
-- record for human publish approvals.
--
-- The policy columns let a key carry what it can do (capability_mask) and what
-- it may still spend (monthly_budget_usd), plus the cooldown that suspends a
-- key after repeated provider errors. last_receipt_json keeps the last computed
-- receipt so the Setup Wizard can show it without re-running the gate.
--
-- publish_ledger holds the human decision for a given tenant+channel+platform+
-- media tuple. The idempotency key is the primary key, so a duplicate publish
-- delivery cannot enqueue a second human decision.

ALTER TABLE user_api_keys ADD COLUMN capability_mask TEXT;
ALTER TABLE user_api_keys ADD COLUMN monthly_budget_usd REAL;
ALTER TABLE user_api_keys ADD COLUMN cooldown_until INTEGER;
ALTER TABLE user_api_keys ADD COLUMN last_receipt_json TEXT;

CREATE TABLE IF NOT EXISTS publish_ledger (
  idempotency_key TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  media_ref TEXT NOT NULL,
  decision TEXT NOT NULL DEFAULT 'pending',
  requester_id TEXT,
  reviewer_id TEXT,
  comment TEXT,
  approved_at INTEGER,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_publish_ledger_tenant
  ON publish_ledger(tenant_id, created_at DESC);
