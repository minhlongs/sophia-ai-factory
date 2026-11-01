-- 0493_publishing_jobs_privacy_status.sql
-- Adds privacy_status column to publishing_jobs so YouTube uploads can honor
-- explicit 'unlisted' / 'private' / 'public' visibility while defaulting to 'public'.

ALTER TABLE publishing_jobs ADD COLUMN privacy_status TEXT DEFAULT 'public';
