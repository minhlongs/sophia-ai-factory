-- Migration: 0262_reality_feedback
-- Reality Loop v1 — structured human feedback at 4 checkpoints.
-- Additive-only, forward-only, safe to rollback (DROP TABLE).
-- 0136 is UNFIT (see docs/reality-loop/INSTRUMENTATION_AUDIT.md:158).
-- All timestamps MILLISECONDS (matches performance_events convention).

CREATE TABLE IF NOT EXISTS reality_feedback (
  id              TEXT PRIMARY KEY,                       -- ulid
  workspace_id    TEXT NOT NULL,
  mission_id      TEXT NOT NULL,
  checkpoint      TEXT NOT NULL,                          -- mission_complete | creative_rejected | human_correction | mission_abandoned
  useful          TEXT NOT NULL,                          -- YES | NO
  reason          TEXT,                                   -- WRONG | LOW_QUALITY | NOT_MY_STYLE | TOO_EXPENSIVE | TOO_SLOW | TOO_COMPLEX | NOT_USEFUL | OTHER (NULL when useful=YES)
  free_text       TEXT,                                   -- optional, <= 2000 chars, NEVER logged raw
  idempotency_key TEXT NOT NULL UNIQUE,                   -- loop_{missionId}_{checkpoint}_{day}
  created_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_reality_feedback_workspace
  ON reality_feedback(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reality_feedback_mission
  ON reality_feedback(mission_id, checkpoint);

CREATE INDEX IF NOT EXISTS idx_reality_feedback_checkpoint
  ON reality_feedback(workspace_id, checkpoint, created_at DESC);
