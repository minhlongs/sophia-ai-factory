-- JWT nonce replay-attack protection table.
--
-- Backs src/lib/auth/jwt-nonce-storage.ts + jwt-nonce-tracker.ts.
-- KV cache is the fast path; this table is the authoritative store and
-- the cleanup target for expired nonces (cron job).
--
-- Schema rationale: `nonce` is the natural identifier. Making it the sole
-- PRIMARY KEY (no separate `id`) is REQUIRED so D1QueryChain.upsert() —
-- which emits bare `INSERT ... ON CONFLICT DO UPDATE SET ...` without a
-- conflict-target column — resolves unambiguously to the nonce constraint.
-- A composite (PK + secondary UNIQUE) schema would silently break upsert
-- under SQLite, leaving replay protection broken when the KV path misses.
--
-- Columns:
--   nonce       JWT jti claim — PRIMARY KEY (replay protection identity).
--   user_id     Owning user.id from Better Auth `user` table.
--   issued_at   Unix epoch seconds — when JWT was minted.
--   expires_at  Unix epoch seconds — used by cleanup `lt('expires_at', now)`
--               and stats `gte/lt` queries; INDEX required.
--   used_at     Unix epoch seconds OR NULL — set by upsert when nonce is
--               consumed; non-null = replay attempt on subsequent check.

CREATE TABLE IF NOT EXISTS jwt_nonces (
  nonce       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  issued_at   INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER
);

-- Cleanup cron: DELETE FROM jwt_nonces WHERE expires_at < now
-- Stats: COUNT(*) WHERE expires_at >= now / < now
CREATE INDEX IF NOT EXISTS idx_jwt_nonces_expires_at
  ON jwt_nonces(expires_at);

-- Per-user audit + future revocation lookups
CREATE INDEX IF NOT EXISTS idx_jwt_nonces_user_id
  ON jwt_nonces(user_id);
