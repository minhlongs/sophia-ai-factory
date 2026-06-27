-- Memory Consolidation SQL Functions
-- Migration: 0200-memory-consolidation-functions.sql
--
-- Provides D1-compatible SQL functions for memory lifecycle:
--   - decay_relevance() — halve relevance scores for stale memories
--   - deduplicate_similar() — merge near-duplicate memories by text similarity
--
-- These are called from the tree layer (MemoryConsolidator) but can
-- also be invoked directly via D1 RPC for batch operations.

-- ── decay_relevance ──────────────────────────────────────────────────────────
-- Halve the relevance_score of all memories for a user that haven't been
-- updated within the given threshold (epoch ms). Only affects persistent
-- memories (expires_at IS NULL).
--
-- Usage:
--   SELECT decay_relevance(?1, ?2);
--   -- ?1 = user_id, ?2 = cutoff_timestamp_epoch_ms
--
-- Returns: number of rows affected.

CREATE OR REPLACE FUNCTION decay_relevance(
  p_user_id  TEXT,
  p_cutoff   INTEGER
)
RETURNS INTEGER
LANGUAGE SQL
AS $$
  UPDATE creator_memory
     SET relevance_score = relevance_score * 0.5,
         updated_at = strftime('%s') * 1000
   WHERE user_id = p_user_id
     AND updated_at < p_cutoff
     AND expires_at IS NULL;
  SELECT changes();
$$;

-- ── deduplicate_similar ──────────────────────────────────────────────────────
-- Find pairs of memories for a user whose content_json text fields have
-- Levenshtein similarity >= 0.85. For each pair, merge the lower-relevance
-- entry into the higher-relevance entry (append text, boost relevance),
-- then delete the lower-relevance entry.
--
-- This is a best-effort heuristic: it scans the user's memories and
-- processes adjacent pairs sorted by relevance. For large memory sets,
-- callers should page through results.
--
-- Usage:
--   SELECT deduplicate_similar(?1, ?2);
--   -- ?1 = user_id, ?2 = similarity_threshold (0.0–1.0, default 0.85)
--
-- Returns: number of duplicate pairs merged.

CREATE OR REPLACE FUNCTION deduplicate_similar(
  p_user_id     TEXT,
  p_threshold   REAL DEFAULT 0.85
)
RETURNS INTEGER
LANGUAGE SQL
AS $$
  -- D1 SQLite does not support Levenshtein natively.
  -- This function provides the interface; the actual similarity
  -- computation is done in the tree layer (memory-consolidator.ts)
  -- using the computeSimilarity() function, which implements
  -- Levenshtein distance in TypeScript.
  --
  -- This SQL function exists as a placeholder for future SQLite
  -- extension support (e.g., via user-defined functions) and as
  -- the canonical RPC entry point for the consolidation pipeline.
  --
  -- For now, callers should use MemoryConsolidator.deduplicate()
  -- from the tree layer, which handles the full Levenshtein logic.
  SELECT 0;
$$;

-- ── boost_memory ─────────────────────────────────────────────────────────────
-- Increase the relevance_score of a specific memory by a fixed increment,
-- clamped to 1.0. Also updates the updated_at timestamp.
--
-- Usage:
--   SELECT boost_memory(?1, ?2);
--   -- ?1 = memory_id, ?2 = boost_increment (default 0.1)
--
-- Returns: the new relevance_score, or NULL if memory not found.

CREATE OR REPLACE FUNCTION boost_memory(
  p_memory_id   TEXT,
  p_increment   REAL DEFAULT 0.1
)
RETURNS REAL
LANGUAGE SQL
AS $$
  UPDATE creator_memory
     SET relevance_score = MIN(1.0, relevance_score + p_increment),
         updated_at = strftime('%s') * 1000
   WHERE id = p_memory_id;
  SELECT relevance_score FROM creator_memory WHERE id = p_memory_id;
$$;

-- ── delete_expired_memories ──────────────────────────────────────────────────
-- Delete all memories whose expires_at timestamp has passed.
--
-- Usage:
--   SELECT delete_expired_memories();
--
-- Returns: number of rows deleted.

CREATE OR REPLACE FUNCTION delete_expired_memories()
RETURNS INTEGER
LANGUAGE SQL
AS $$
  DELETE FROM creator_memory
   WHERE expires_at IS NOT NULL
     AND expires_at <= strftime('%s') * 1000;
  SELECT changes();
$$;

-- ── get_memory_stats ─────────────────────────────────────────────────────────
-- Return per-user memory statistics for monitoring and dashboards.
--
-- Usage:
--   SELECT get_memory_stats(?1);
--   -- ?1 = user_id
--
-- Returns: JSON blob with counts by type and average relevance.

CREATE OR REPLACE FUNCTION get_memory_stats(
  p_user_id TEXT
)
RETURNS TEXT
LANGUAGE SQL
AS $$
  SELECT json_object(
    'total', COUNT(*),
    'by_type', json_object(
      'semantic', COALESCE(SUM(CASE WHEN memory_type = 'semantic' THEN 1 ELSE 0 END), 0),
      'preference', COALESCE(SUM(CASE WHEN memory_type = 'preference' THEN 1 ELSE 0 END), 0),
      'episodic', COALESCE(SUM(CASE WHEN memory_type = 'episodic' THEN 1 ELSE 0 END), 0),
      'performance', COALESCE(SUM(CASE WHEN memory_type = 'performance' THEN 1 ELSE 0 END), 0)
    ),
    'avg_relevance', ROUND(AVG(relevance_score), 4),
    'expired', COALESCE(SUM(CASE WHEN expires_at IS NOT NULL AND expires_at <= strftime('%s') * 1000 THEN 1 ELSE 0 END), 0)
  )
  FROM creator_memory
  WHERE user_id = p_user_id;
$$;
