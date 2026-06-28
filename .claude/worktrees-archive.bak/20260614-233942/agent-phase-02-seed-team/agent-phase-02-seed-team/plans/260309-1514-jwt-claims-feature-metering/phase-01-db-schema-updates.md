---
title: "Phase 1: Database Schema Updates"
description: "Add feature_name column to usage_events and jwt_nonce tracking table"
status: pending
priority: P1
effort: 1h
---

# Phase 1: Database Schema Updates

## Overview

Extend database schema to support:
1. Feature-level metering (`feature_name` column)
2. JWT nonce tracking (replay attack prevention)
3. License context caching

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/260309-1514-add-feature-columns.sql` | Create | Add `feature_name`, `feature_key` to `usage_events` |
| `supabase/migrations/260309-1515-create-jwt-nonces.sql` | Create | JWT nonce table for replay prevention |
| `src/lib/supabase/types.ts` | Modify | Add new type definitions |

## Implementation Steps

### Step 1.1: Add Feature Columns to usage_events

```sql
-- File: supabase/migrations/260309-1514-add-feature-columns.sql
-- Add feature-level metering columns

ALTER TABLE usage_events
ADD COLUMN IF NOT EXISTS feature_name TEXT,
ADD COLUMN IF NOT EXISTS feature_key TEXT;

-- Create index for feature-based queries
CREATE INDEX IF NOT EXISTS idx_usage_events_feature_key
ON usage_events(feature_key, created_at);

-- Add comment for documentation
COMMENT ON COLUMN usage_events.feature_name IS 'Human-readable feature name (e.g., "Video Generation")';
COMMENT ON COLUMN usage_events.feature_key IS 'Machine-readable key (e.g., "heygen.createVideo")';
```

### Step 1.2: Create jwt_nonces Table

```sql
-- File: supabase/migrations/260309-1515-create-jwt-nonces.sql
-- JWT nonce tracking for replay attack prevention

CREATE TABLE IF NOT EXISTS jwt_nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  issued_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  used_at BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Index for fast lookup during JWT verification
  CONSTRAINT idx_jwt_nonces_nonce UNIQUE (nonce),
  CONSTRAINT idx_jwt_nonces_user_id FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Index for cleanup queries
CREATE INDEX idx_jwt_nonces_expires_at ON jwt_nonces(expires_at);
CREATE INDEX idx_jwt_nonces_used_at ON jwt_nonces(used_at) WHERE used_at IS NULL;

-- RLS Policy (if not already enabled)
ALTER TABLE jwt_nonces ENABLE ROW LEVEL SECURITY;

-- Only service role can insert/verify nonces
CREATE POLICY "Service role can manage nonces"
  ON jwt_nonces
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Comment for documentation
COMMENT ON TABLE jwt_nonces IS 'JWT nonce tracking for replay attack prevention';
COMMENT ON COLUMN jwt_nonces.nonce IS 'Unique JWT identifier (jti claim)';
COMMENT ON COLUMN jwt_nonces.used_at IS 'Timestamp when JWT was first used (null = unused)';
```

### Step 1.3: Update TypeScript Types

```typescript
// File: src/lib/supabase/types.ts
// Add/modify these interfaces:

export interface UsageEventsRow {
  id: string;
  user_id: string;
  license_key_hash: string;
  license_nonce: string;
  service_name: string;
  endpoint: string;
  action: string;
  tokens_input: number;
  tokens_output: number;
  credits_used: number;
  request_id: string | null;
  model_name: string | null;
  tier_at_request: string;
  status_code: number | null;
  error_message: string | null;
  response_time_ms: number | null;
  created_at: number;
  idempotency_key: string | null;
  external_customer_id: string | null;
  resource_type: string | null;
  // NEW: Feature-level metering
  feature_name: string | null;
  feature_key: string | null;
}

export interface JwtNoncesRow {
  id: string;
  nonce: string;
  user_id: string;
  issued_at: number;
  expires_at: number;
  used_at: number | null;
  created_at: string;
}
```

## Verification

```bash
# Apply migrations
npx supabase db push

# Verify columns exist
psql "$(npx supabase db url)" -c "
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'usage_events'
  AND column_name IN ('feature_name', 'feature_key');
"

# Verify jwt_nonces table exists
psql "$(npx supabase db url)" -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_name = 'jwt_nonces';
"
```

## Success Criteria

- [ ] `feature_name` and `feature_key` columns added to `usage_events`
- [ ] `jwt_nonces` table created with indexes
- [ ] TypeScript types updated
- [ ] Migration can be applied without errors

## Rollback

```sql
-- Rollback feature columns
ALTER TABLE usage_events
DROP COLUMN IF EXISTS feature_name,
DROP COLUMN IF EXISTS feature_key;

-- Drop jwt_nonces table
DROP TABLE IF EXISTS jwt_nonces CASCADE;
```
