-- Migration: Create JWT Nonces Table
-- Date: 2026-03-09
-- Phase: 6A - JWT Claims Enrichment + Feature-Level Metering
-- Description: Create jwt_nonces table for replay attack prevention (tracks JWT jti claims)

-- Create jwt_nonces table for tracking JWT usage
CREATE TABLE IF NOT EXISTS jwt_nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce TEXT NOT NULL,                    -- JWT jti claim value
  user_id TEXT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issued_at BIGINT NOT NULL,              -- Unix timestamp when nonce was issued
  expires_at BIGINT NOT NULL,             -- Unix timestamp when nonce expires
  used_at BIGINT,                         -- Unix timestamp when JWT was first used (null = unused)
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure nonce uniqueness
  CONSTRAINT jwt_nonces_nonce_unique UNIQUE (nonce)
);

-- Index for fast nonce lookup during JWT verification
CREATE INDEX IF NOT EXISTS idx_jwt_nonces_nonce ON jwt_nonces(nonce);

-- Index for cleanup queries (find expired nonces)
CREATE INDEX IF NOT EXISTS idx_jwt_nonces_expires_at ON jwt_nonces(expires_at);

-- Index for finding unused nonces (potential security audit)
CREATE INDEX IF NOT EXISTS idx_jwt_nonces_unused ON jwt_nonces(used_at) WHERE used_at IS NULL;

-- Index for user-based queries
CREATE INDEX IF NOT EXISTS idx_jwt_nonces_user_id ON jwt_nonces(user_id);

-- Enable Row Level Security
ALTER TABLE jwt_nonces ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can manage nonces (full access)
CREATE POLICY "Service role can manage nonces"
  ON jwt_nonces
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policy: Users can view their own nonces (read-only for audit)
CREATE POLICY "Users can view own nonces"
  ON jwt_nonces
  FOR SELECT
  USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE jwt_nonces IS 'JWT nonce tracking for replay attack prevention - tracks jti claims to prevent token reuse';
COMMENT ON COLUMN jwt_nonces.nonce IS 'JWT jti (JWT ID) claim value - unique identifier for each JWT';
COMMENT ON COLUMN jwt_nonces.used_at IS 'Timestamp when JWT was first used - null means never used (potential replay candidate)';
COMMENT ON COLUMN jwt_nonces.expires_at IS 'Expiration timestamp from JWT exp claim - used for cleanup';

-- Create cleanup function (for cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_jwt_nonces()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM jwt_nonces
    WHERE expires_at < (EXTRACT(EPOCH FROM NOW())::BIGINT)
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execute on cleanup function to service role
GRANT EXECUTE ON FUNCTION cleanup_expired_jwt_nonces() TO service_role;

-- Verify table was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'jwt_nonces'
  ) THEN
    RAISE NOTICE 'jwt_nonces table created successfully';
  ELSE
    RAISE EXCEPTION 'Failed to create jwt_nonces table';
  END IF;
END $$;
