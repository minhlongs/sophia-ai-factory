-- Migration 0148: Add UNIQUE constraint on videos.purchase_id
-- P1-3 fix: prevents double video rendering under concurrent webhook delivery.
-- The app-level idempotency check (findByPurchaseId) is a TOCTOU race;
-- this DB-level constraint is the authoritative guard.
--
-- purchase_id is nullable (subscription/manual videos have no purchase),
-- so the UNIQUE constraint only applies to non-NULL values per SQL standard.
-- D1/SQLite enforces this correctly: multiple NULLs are allowed.

-- D1/SQLite requires table rebuild to add UNIQUE constraint on existing column.
-- Instead we use a UNIQUE partial index which is functionally equivalent and
-- non-destructive.

DROP INDEX IF EXISTS idx_videos_purchase_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_purchase_id_unique
  ON videos(purchase_id)
  WHERE purchase_id IS NOT NULL;
