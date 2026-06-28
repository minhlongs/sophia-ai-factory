-- Migration 0045: Restore is_onboarding column to videos table
-- Background: Migration 0043 rebuilt the videos table (temp-table swap) but
-- did not carry forward the is_onboarding column added in 0034.
-- Code in videos-repo.ts (INSERT) and src/lib/video/onboarding-video.ts (INSERT)
-- and src/app/api/webhooks/heygen/route.ts (SELECT) all reference this column.
-- Applying this migration restores the column with its original DEFAULT 0 semantics.
--
-- SQLite supports ALTER TABLE ... ADD COLUMN for new nullable or DEFAULT columns.
-- This operation is safe and non-destructive; existing rows get is_onboarding=0.

ALTER TABLE videos ADD COLUMN is_onboarding INTEGER NOT NULL DEFAULT 0;
