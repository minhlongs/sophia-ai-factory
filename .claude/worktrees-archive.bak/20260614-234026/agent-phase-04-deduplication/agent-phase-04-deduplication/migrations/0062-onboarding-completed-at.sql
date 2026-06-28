-- Migration 0062: Add onboarding_completed_at to user_profiles
-- Used by onboarding tour modal to detect first-login vs returning user

ALTER TABLE user_profiles ADD COLUMN onboarding_completed_at INTEGER;
