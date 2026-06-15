-- Sophia AI Factory D1 Migration 0008
-- Phase 4E: LLM Semantic Cache (exact-match MVP)
-- Stores LLM responses keyed by SHA-256 hash of normalized (provider + model + messages).
-- TTL via expires_at column; purge job deferred to Phase 4E.3.

CREATE TABLE IF NOT EXISTS llm_cache (
  hash           TEXT PRIMARY KEY,
  provider       TEXT NOT NULL,
  model          TEXT NOT NULL,
  response       TEXT NOT NULL,
  input_tokens   INTEGER,
  output_tokens  INTEGER,
  cost_usd       REAL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at     TEXT NOT NULL,
  hit_count      INTEGER NOT NULL DEFAULT 0
);

-- Index for future purge job (WHERE expires_at < datetime('now'))
CREATE INDEX IF NOT EXISTS idx_llm_cache_expires_at
  ON llm_cache(expires_at);
