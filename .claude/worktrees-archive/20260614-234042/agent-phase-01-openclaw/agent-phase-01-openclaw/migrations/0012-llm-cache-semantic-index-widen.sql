-- Phase 4E.2-TUNING: widen semantic-cache top-K index to match the
-- four equality columns used by `semanticLookup` in llm-cache-semantic.ts:
--   WHERE org_id=? AND embedding_model=? AND provider=? AND model=?
--   ORDER BY created_at DESC LIMIT K
--
-- Original index (migration 0010) covered (org_id, embedding_model,
-- created_at DESC). On multi-model orgs the planner had to filter
-- provider+model post-scan, shrinking the effective top-K.

DROP INDEX IF EXISTS idx_llm_cache_org_model_created;

CREATE INDEX IF NOT EXISTS idx_llm_cache_semantic_scan
  ON llm_cache(org_id, embedding_model, provider, model, created_at DESC);
