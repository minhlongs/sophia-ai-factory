-- Migration 0100: UNIQUE(paired_by) on telegram_paired_chats
--
-- Problem: telegram_paired_chats allows multiple rows per user (paired_by has no constraint).
-- Every consumer assumes 1:1 via LIMIT 1 / maybeSingle — silent multi-pair bug risk.
--
-- D1/SQLite cannot ALTER TABLE ADD CONSTRAINT — use the table-rebuild pattern (same as 0089).
--
-- ONE-SHOT MIGRATION. SQLite ALTER TABLE RENAME and DROP TABLE are NOT idempotent.
-- The CREATE TABLE _new and CREATE INDEX use IF NOT EXISTS but DROP+RENAME do not.
-- Apply via apply-migrations.sh exactly once. Re-runs will error on DROP TABLE.
--
-- BEFORE applying this migration, run on remote D1 to audit for legitimate multi-pair users:
--   SELECT paired_by, COUNT(*) AS dup FROM telegram_paired_chats
--   GROUP BY paired_by HAVING dup > 1;
-- If any rows returned, decide: keep newest (default behavior of this migration, via MAX paired_at)
-- OR alert affected user(s) before deduping. This migration silently keeps the row with
-- the latest paired_at per paired_by.
--
-- Dedup keeps the newest row per paired_by (by MAX(paired_at)). Any duplicate is resolved
-- before the new table is created, so the INSERT INTO ... SELECT cannot violate constraints.
--
-- After this migration, approvePairing() upsert (which uses ON CONFLICT DO UPDATE SET)
-- will handle re-pairing gracefully: conflict on UNIQUE(paired_by) triggers UPDATE of
-- chat_id/first_name/paired_at to the new values (user paired a different chat).

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS telegram_paired_chats_new (
  chat_id  TEXT PRIMARY KEY,
  first_name TEXT,
  paired_at  TEXT NOT NULL DEFAULT (datetime('now')),
  paired_by  TEXT NOT NULL UNIQUE
);

-- Dedup: for each paired_by keep only the row with the most recent paired_at.
-- ROW_NUMBER() OVER (PARTITION BY paired_by ORDER BY paired_at DESC) = 1 selects the newest.
INSERT INTO telegram_paired_chats_new (chat_id, first_name, paired_at, paired_by)
SELECT chat_id, first_name, paired_at, paired_by
FROM (
  SELECT
    chat_id,
    first_name,
    paired_at,
    paired_by,
    ROW_NUMBER() OVER (PARTITION BY paired_by ORDER BY paired_at DESC) AS rn
  FROM telegram_paired_chats
)
WHERE rn = 1;

DROP TABLE telegram_paired_chats;
ALTER TABLE telegram_paired_chats_new RENAME TO telegram_paired_chats;

-- Explicit index on paired_by for fast lookup by consumer queries
-- (WHERE paired_by = ? is the primary read pattern).
-- The UNIQUE constraint already creates an implicit index, but naming it aids EXPLAIN QUERY PLAN.
CREATE INDEX IF NOT EXISTS idx_telegram_paired_by
  ON telegram_paired_chats(paired_by);

PRAGMA foreign_keys = ON;
