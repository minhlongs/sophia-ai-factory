-- Checkpoint support for engine_missions (OpenMontage port Phase 01)
-- Adds checkpoint_json column for workflow step state persistence
-- When a mission is interrupted (cold-start, timeout, crash), the dispatcher
-- can resume from the last checkpoint instead of restarting from scratch.

ALTER TABLE engine_missions ADD COLUMN checkpoint_json TEXT;

CREATE INDEX IF NOT EXISTS idx_engine_missions_checkpoint
  ON engine_missions(checkpoint_json) WHERE checkpoint_json IS NOT NULL;
