-- Creator memory: persistent context about each creator's preferences,
-- past performance, and patterns. Enables personalized SOP execution by
-- injecting relevant memories into prompt context at runtime.

CREATE TABLE IF NOT EXISTS creator_memory (
  id                   TEXT    PRIMARY KEY,
  user_id              TEXT    NOT NULL,
  -- 'episodic'   — specific execution results (e.g. "video X got 50K views with hook style Y")
  -- 'semantic'   — general knowledge about creator (e.g. "prefers casual tone, targets 18-35")
  -- 'preference' — explicit user preferences (e.g. "always use blue thumbnails")
  -- 'performance'— aggregated metrics (e.g. "avg CTR 4.2% on faceless videos")
  memory_type          TEXT    NOT NULL CHECK(memory_type IN ('episodic','semantic','preference','performance')),
  category             TEXT    NOT NULL,
  content_json         TEXT    NOT NULL,
  -- Higher = more relevant. Updated by decay/boost calls. Used for ranked retrieval.
  relevance_score      REAL    DEFAULT 1.0,
  source_execution_id  TEXT,
  -- Epoch ms. NULL = never expires.
  expires_at           INTEGER,
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);

-- Primary retrieval index: get all memories for a user by type, ranked by relevance.
CREATE INDEX IF NOT EXISTS idx_creator_mem_user
  ON creator_memory(user_id, memory_type, relevance_score DESC);

-- Category-scoped retrieval sorted by recency (for "latest preference in X category").
CREATE INDEX IF NOT EXISTS idx_creator_mem_category
  ON creator_memory(user_id, category, updated_at DESC);

-- Partial index for expiry sweep — only rows that actually expire are indexed.
CREATE INDEX IF NOT EXISTS idx_creator_mem_expiry
  ON creator_memory(expires_at) WHERE expires_at IS NOT NULL;
