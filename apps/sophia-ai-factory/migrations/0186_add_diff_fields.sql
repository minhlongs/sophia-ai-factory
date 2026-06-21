-- Migration 0186: Add diff_summary and files_changed to deploy_guard_approvals
-- Purpose: Store deploy manifest details for admin UI display
-- Created: 2026-06-21

ALTER TABLE deploy_guard_approvals ADD COLUMN diff_summary TEXT;
ALTER TABLE deploy_guard_approvals ADD COLUMN files_changed INTEGER;

-- Indexes not needed for these infrequently queried columns

COMMIT;
