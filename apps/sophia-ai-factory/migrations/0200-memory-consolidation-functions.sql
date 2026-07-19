-- Memory Consolidation SQL Functions
-- Migration: 0200-memory-consolidation-functions.sql
--
-- NOTE: D1 SQLite does not support CREATE FUNCTION.
-- These functions are defined here as documentation/placeholder.
-- Actual consolidation logic runs in TypeScript (tree layer):
--   src/tree/memory/memory-consolidator.ts
--
-- When D1 adds UDF support or we migrate to a DB with function support,
-- uncomment and adapt these definitions.
--
-- Function signatures (for reference):
--   SELECT decay_relevance(p_user_id, p_cutoff_epoch_ms);
--   SELECT deduplicate_similar(p_user_id, p_threshold);
--   SELECT boost_memory(p_memory_id, p_increment);
--   SELECT delete_expired_memories();
--   SELECT get_memory_stats(p_user_id);

-- No-op: functions defined in TypeScript layer
SELECT 1;
