-- Phase 4E.2: Semantic cache — add embedding columns to llm_cache.
-- Purpose: store per-row Float32Array embedding so lookupCache can do
-- semantic (cosine) fallback when the exact-hash miss.
--
-- All columns nullable → zero impact on existing Phase 4E exact-match rows.
-- Feature is env-gated (LLM_CACHE_SEMANTIC_ENABLED=1); if off, the new
-- columns stay NULL and the code path short-circuits.
--
-- Vector dim: 768 (Workers AI `@cf/baai/bge-base-en-v1.5`).
-- Packed as Float32Array (3 KB per row). No native D1 vector type.

ALTER TABLE llm_cache ADD COLUMN embedding BLOB;
ALTER TABLE llm_cache ADD COLUMN embedding_model TEXT;
ALTER TABLE llm_cache ADD COLUMN prompt_text TEXT;

-- Supports top-K candidate scan: filter by (org_id, embedding_model),
-- then ORDER BY created_at DESC LIMIT K in application code.
CREATE INDEX IF NOT EXISTS idx_llm_cache_org_model_created
  ON llm_cache(org_id, embedding_model, created_at DESC);
