-- ============================================================================
-- MIGRATION 011: OpenClaw Engine Tables
-- ============================================================================
-- Creates: mission_dependencies, mission_retries
-- Alters:  missions (adds retry, parent, webhook, sub-mission columns)
-- ============================================================================

-- ============================================================================
-- 1. MISSION_DEPENDENCIES
-- Tracks parent-child mission chaining (sequential or parallel)
-- ============================================================================
CREATE TABLE IF NOT EXISTS mission_dependencies (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_mission_id UUID       NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  child_mission_id  UUID       NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  dependency_type  TEXT        NOT NULL DEFAULT 'sequential'
                               CHECK (dependency_type IN ('sequential', 'parallel')),
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mission_deps_parent ON mission_dependencies(parent_mission_id);
CREATE INDEX idx_mission_deps_child  ON mission_dependencies(child_mission_id);

-- ============================================================================
-- 2. MISSION_RETRIES
-- Audit trail for each retry attempt with error snapshot
-- ============================================================================
CREATE TABLE IF NOT EXISTS mission_retries (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id     UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  attempt_number INT  NOT NULL DEFAULT 1,
  error_message  TEXT,
  retried_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mission_retries ON mission_retries(mission_id);

-- ============================================================================
-- 3. ALTER MISSIONS: add OpenClaw engine columns
-- ============================================================================
ALTER TABLE missions ADD COLUMN IF NOT EXISTS max_retries      INT     DEFAULT 3;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS retry_count      INT     DEFAULT 0;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS parent_mission_id UUID   REFERENCES missions(id);
ALTER TABLE missions ADD COLUMN IF NOT EXISTS webhook_url      TEXT;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS is_sub_mission   BOOLEAN DEFAULT false;

-- Index for fast sibling lookup (parent → children)
CREATE INDEX IF NOT EXISTS idx_missions_parent ON missions(parent_mission_id)
  WHERE parent_mission_id IS NOT NULL;
