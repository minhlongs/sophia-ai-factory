-- Phase 4E H-1: org scoping — drop + recreate llm_cache with org_id NOT NULL.
-- Safe because LLM_CACHE_ENABLED OFF in prod + cache rebuildable.
-- Backfill strategy: DELETE ALL existing rows (cache is env-gated off; no prod data at risk).

DROP TABLE IF EXISTS llm_cache;

CREATE TABLE llm_cache (
  hash           TEXT    NOT NULL,
  org_id         TEXT    NOT NULL,
  provider       TEXT    NOT NULL,
  model          TEXT    NOT NULL,
  response       TEXT    NOT NULL,
  input_tokens   INTEGER,
  output_tokens  INTEGER,
  cost_usd       REAL,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at     TEXT    NOT NULL,
  hit_count      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (hash, org_id)
);

-- Efficient per-org purge (Phase 4E.3) and lookup
CREATE INDEX IF NOT EXISTS idx_llm_cache_org_expires
  ON llm_cache(org_id, expires_at);
