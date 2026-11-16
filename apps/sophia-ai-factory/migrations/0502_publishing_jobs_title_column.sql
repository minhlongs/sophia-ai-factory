-- 0502_publishing_jobs_title_column.sql
-- Adds title column to publishing_jobs so executionPublishWorker and platform uploaders
-- persist video titles without D1 schema mismatch.

ALTER TABLE publishing_jobs ADD COLUMN title TEXT;
