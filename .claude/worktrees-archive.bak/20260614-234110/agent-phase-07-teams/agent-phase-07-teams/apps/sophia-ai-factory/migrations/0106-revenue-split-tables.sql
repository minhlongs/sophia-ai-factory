-- Migration 0106: Revenue Split tables — commission_ledger, payout_batches, payout_methods.
--
-- Why this exists:
--   Original Phase 13 schema lived in `src/seed/db/migrations/0038-revenue-split.sql`,
--   which is OUTSIDE the canonical `migrations/` folder that `scripts/apply-migrations.sh`
--   walks. Result: only `tenant_settings` was later ported (as 0085 with a different
--   namespaced schema) and the other 3 tables never got created on remote D1.
--   `payout-batcher.ts` and `/api/affiliate/payout-method/route.ts` were silently
--   running against missing tables.
--
-- Notes:
--   - Schema is a verbatim copy of 0038's tables (commission_ledger, payout_batches,
--     payout_methods) so existing code paths require zero changes.
--   - `tenant_settings` intentionally SKIPPED — the namespaced 0085 schema is canonical.
--     `conversion-to-ledger.ts` is being refactored in the same commit to read VN PIT
--     flag via `tenant_settings.value` JSON (namespace='vn_pit') instead of the dropped
--     `vn_pit_enabled` column.
--   - All statements use IF NOT EXISTS so re-running is safe on environments where a
--     partial 0038 was hand-applied.

CREATE TABLE IF NOT EXISTS commission_ledger (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  affiliate_id TEXT NOT NULL,
  conversion_event_id TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  gross_cents INTEGER NOT NULL,
  commission_pct REAL NOT NULL,
  commission_cents INTEGER NOT NULL,
  withheld_cents INTEGER NOT NULL DEFAULT 0,
  parent_conversion_id TEXT,
  status TEXT CHECK(status IN ('pending','payable','paid','clawed_back','rejected','paying','clawback')) NOT NULL,
  payable_at INTEGER NOT NULL,
  paid_at INTEGER,
  payout_batch_id TEXT,
  clawback_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(conversion_event_id)
);

CREATE TABLE IF NOT EXISTS payout_batches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  affiliate_id TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  ledger_count INTEGER NOT NULL,
  status TEXT CHECK(status IN ('queued','sending','confirmed','failed')) NOT NULL,
  payment_method TEXT NOT NULL,
  external_payment_id TEXT,
  network TEXT DEFAULT 'TRC20',
  recipient_addr_encrypted TEXT NOT NULL,
  test_payment_confirmed INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  finalized_at INTEGER
);

CREATE TABLE IF NOT EXISTS payout_methods (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  affiliate_id TEXT NOT NULL,
  method TEXT CHECK(method IN ('usdt_trc20','usdt_erc20','bank_account')) NOT NULL,
  recipient_addr_encrypted TEXT NOT NULL,
  display_label TEXT,
  is_default INTEGER DEFAULT 0,
  verified INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(tenant_id, affiliate_id, method, recipient_addr_encrypted)
);

CREATE INDEX IF NOT EXISTS idx_ledger_tenant_status ON commission_ledger(tenant_id, status, payable_at);
CREATE INDEX IF NOT EXISTS idx_ledger_affiliate ON commission_ledger(affiliate_id, status, payable_at);
CREATE INDEX IF NOT EXISTS idx_ledger_parent ON commission_ledger(parent_conversion_id) WHERE parent_conversion_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_batch_affiliate ON payout_batches(affiliate_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_method_affiliate ON payout_methods(affiliate_id, is_default);
