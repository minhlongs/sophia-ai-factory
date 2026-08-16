-- Circuit breaker Phase 1: per-key isolation + lockout durations
-- Migrate from service-only PK to composite (service, keyRef) PK with lockout_seconds per key ref.
-- Back-compat: legacy single-key rows (keyRef IS NULL) remain queryable during migration.

-- 1. New schema with composite PRIMARY KEY (service, keyRef)
-- keyRef='platform' preserves single shared fallback; NULLs are coalesced to 'platform'.
CREATE TABLE IF NOT EXISTS circuit_breaker_state_v2 (
  service  TEXT NOT NULL,
  key_ref  TEXT NOT NULL DEFAULT 'platform',
  state    TEXT NOT NULL DEFAULT 'CLOSED',
  failure_count     INTEGER NOT NULL DEFAULT 0,
  last_failure_at   TEXT,
  cooldown_until    TEXT,
  lockout_seconds   INTEGER,                        -- override cooldown for this key (ms)
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (service, key_ref)
) WITHOUT ROWID;

-- 2. Migrate legacy data (single-key rows → keyRef='platform')
INSERT INTO circuit_breaker_state_v2 (service, key_ref, state, failure_count, last_failure_at, cooldown_until, created_at, updated_at)
SELECT service, 'platform', state, failure_count, last_failure_at, cooldown_until, created_at, updated_at
FROM   circuit_breaker_state
WHERE  service NOT IN (SELECT service FROM circuit_breaker_state_v2);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_cb_v2_updated  ON circuit_breaker_state_v2(updated_at);
CREATE INDEX IF NOT EXISTS idx_cb_v2_cooldown ON circuit_breaker_state_v2(cooldown_until)
WHERE cooldown_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cb_v2_key_ref  ON circuit_breaker_state_v2(service, key_ref);

-- 4. Drop legacy table (data already migrated)
DROP TABLE IF EXISTS circuit_breaker_state;

-- 5. Rename v2 → canonical name
ALTER TABLE circuit_breaker_state_v2 RENAME TO circuit_breaker_state;