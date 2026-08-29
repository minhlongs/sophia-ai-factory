-- Migration: 0263_creative_economic_snapshot
-- Reality Loop v1 — mission-scoped economic measurement boundary (Phase H).
--
-- ADDITIVE-ONLY. Every column is nullable: a missing source datum is NULL,
-- never 0. The writer populates strictly from existing producers:
--   - creative_cost / production_cost / distribution_cost ← recordSpend totals
--       (tree/mission/repository.ts:183 — the ONLY cost source of truth)
--   - revenue ← existing idempotent revenue bridges (YouTube / TikTok /
--       ad-revenue / sponsorship / affiliate / commerce → performance_events)
--   - leads / conversions ← NO producer exists yet → always NULL (see
--       SOPHIA_VALUE_SCORECARD.md Group 6: "blocked on Phase C + Phase H").
--
-- No synthetic defaults. No ROI column — ROI is computed by callers that
-- choose to, and only when both revenue AND cost are present.
--
-- Timestamps: recorded_at is epoch MILLISECONDS (matches performance_events).

CREATE TABLE IF NOT EXISTS creative_economic_snapshot (
  id                  TEXT PRIMARY KEY,
  workspace_id        TEXT NOT NULL,
  mission_id          TEXT,
  -- Cost side: recordSpend totals only. All three nullable — a mission
  -- that spent nothing in a category stays NULL, never 0.
  creative_cost       INTEGER,
  production_cost     INTEGER,
  distribution_cost   INTEGER,
  -- Outcome side: leads/conversions have no producer yet (always NULL).
  leads               INTEGER,
  conversions         INTEGER,
  -- Revenue side: sum of value_cents from the idempotent revenue bridges.
  -- NULL when no revenue event exists for this mission.
  revenue             INTEGER,
  recorded_at         INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_creative_econ_snapshot_mission
  ON creative_economic_snapshot(mission_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_creative_econ_snapshot_workspace
  ON creative_economic_snapshot(workspace_id, recorded_at DESC);