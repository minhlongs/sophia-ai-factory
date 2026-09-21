-- Migration 0281: Add key_validated_at column to user_api_keys
-- Supports tracking validation timestamp for BYOK credentials.

ALTER TABLE user_api_keys ADD COLUMN key_validated_at INTEGER;
