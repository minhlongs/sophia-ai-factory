-- Migration 0271: Add latency_ms to media_jobs
--
-- Required by SUPREME COMMAND #13 (temporal integrity fix).
-- Sync Fal.ai success paths now write result.latencyMs into this column so the
-- economics dashboard shows real provider latency instead of the derived
-- (completed_at - started_at) * 1000 approximation.
--
-- Nullable to preserve backward compatibility with existing rows.

ALTER TABLE media_jobs ADD COLUMN latency_ms INTEGER;   -- Provider-reported latency in ms (NULL if not available)