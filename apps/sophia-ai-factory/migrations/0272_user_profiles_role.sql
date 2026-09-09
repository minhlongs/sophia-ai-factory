-- Migration 0272: Add role column to user_profiles
-- Ensures tracked schema matches runtime usage in is-user-admin.ts and middleware.
-- Additive change; guarded by scripts/apply-migrations.sh pragma_table_info check.

ALTER TABLE user_profiles ADD COLUMN role TEXT DEFAULT 'user';

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
