-- Migration 0099: Add provider column to publishing_jobs for Telegram special-case dispatch.
-- SQLite cannot ALTER TABLE to add column with DEFAULT when table has existing rows,
-- but it CAN add a nullable TEXT column with a DEFAULT (SQLite 3.37+).
-- D1 supports this pattern: ALTER TABLE ... ADD COLUMN with DEFAULT.
--
-- provider = 'telegram' allows publishExecute to bypass publishing_channels lookup.
-- For existing rows (non-telegram), provider defaults to '' (empty string).
-- Telegram rows will have provider = 'telegram' set by schedule-publish.
-- One-shot migration. SQLite does not support IF NOT EXISTS on ADD COLUMN.
-- Apply via apply-migrations.sh exactly once. Re-runs will error with "duplicate column name: provider" — that is expected.

ALTER TABLE publishing_jobs ADD COLUMN provider TEXT NOT NULL DEFAULT '';
