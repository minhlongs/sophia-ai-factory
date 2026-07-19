-- Migration: Add License Foreign Key to API Keys
-- Date: 2026-03-09
-- Phase: 6B - API Key License Integration
-- Description: Add associated_license_nonce column to raas_api_keys for JWT enrichment

-- Add foreign key column to link API keys with licenses
ALTER TABLE raas_api_keys
ADD COLUMN IF NOT EXISTS associated_license_nonce TEXT;

-- Add foreign key constraint
ALTER TABLE raas_api_keys
ADD CONSTRAINT fk_raas_api_keys_license
FOREIGN KEY (associated_license_nonce)
REFERENCES raas_licenses(license_nonce)
ON DELETE SET NULL;

-- Create index for fast license lookup during API key validation
CREATE INDEX IF NOT EXISTS idx_raas_api_keys_license_nonce
ON raas_api_keys(associated_license_nonce);

-- Create index for owner-based queries
CREATE INDEX IF NOT EXISTS idx_raas_api_keys_owner_id
ON raas_api_keys(owner_id);

-- Add comment for documentation
COMMENT ON COLUMN raas_api_keys.associated_license_nonce IS 'License associated with this API key - used for JWT enrichment during validation';

-- Update existing API keys to link to their owner's active license (if applicable)
-- This assumes raas_licenses has created_by referencing the user
UPDATE raas_api_keys rak
SET associated_license_nonce = rl.license_nonce
FROM raas_licenses rl
WHERE rak.owner_id = rl.created_by
  AND rak.associated_license_nonce IS NULL
  AND rl.status = 'active';

-- Verify column was added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'raas_api_keys'
    AND column_name = 'associated_license_nonce'
  ) THEN
    RAISE NOTICE 'associated_license_nonce column added successfully';
  ELSE
    RAISE EXCEPTION 'Failed to add associated_license_nonce column';
  END IF;
END $$;
