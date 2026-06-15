---
title: "Phase 02: Atomic Quota Enforcement"
description: "Implement PL/pgSQL function for atomic quota check and increment"
status: pending
priority: P1
effort: 2h
---

# Phase 02: Atomic Quota Enforcement

## Context

From `constants.ts`:
```typescript
export const QUOTA_LIMITS = {
  BASIC: { dailyCredits: 100, hourlyCredits: 20, ... },
  PREMIUM: { dailyCredits: 500, hourlyCredits: 100, ... },
  ENTERPRISE: { dailyCredits: 2000, hourlyCredits: 500, ... },
  MASTER: { dailyCredits: 10000, hourlyCredits: 2000, ... },
};
```

**Problem:** Current quota check is in TypeScript → race condition when concurrent requests arrive.

**Solution:** Atomic PL/pgSQL function with `SELECT ... FOR UPDATE` and `ON CONFLICT DO UPDATE`.

## Requirements

**Functional:**
1. Create `quota_limits` table with tier configuration
2. Create `usage_hourly_quota` tracking table
3. Create `check_and_increment_quota()` PL/pgSQL function
4. Function returns `{ allowed, remaining_hourly, remaining_daily }`
5. Atomic increment within transaction

**Non-Functional:**
1. Function executes in < 10ms
2. No race conditions under concurrent load
3. SECURITY DEFINER for controlled access

## Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `docs/migrations/quota-enforcement-schema.sql` | Create | Quota tables and function |
| `src/lib/usage-metering/quota-checker.ts` | Create | TypeScript wrapper for DB function |
| `src/lib/usage-metering/constants.ts` | Update | Remove hardcoded limits (use DB) |
| `src/app/api/v1/usage/batch/route.ts` | Update | Call quota check before ingestion |

## Implementation Steps

### 1. Create Quota Schema

```sql
-- File: docs/migrations/quota-enforcement-schema.sql

-- Step 1: Create quota_limits table (tier configuration)
CREATE TABLE IF NOT EXISTS quota_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT UNIQUE NOT NULL,
  daily_credits INTEGER NOT NULL,
  hourly_credits INTEGER NOT NULL,
  daily_requests INTEGER NOT NULL,
  monthly_credits INTEGER NOT NULL,
  reset_hour INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Insert default tier limits
INSERT INTO quota_limits (tier, daily_credits, hourly_credits, daily_requests, monthly_credits)
VALUES
  ('BASIC', 100, 20, 500, 2000),
  ('PREMIUM', 500, 100, 2500, 10000),
  ('ENTERPRISE', 2000, 500, 10000, 50000),
  ('MASTER', 10000, 2000, 50000, 200000)
ON CONFLICT (tier) DO UPDATE SET
  daily_credits = EXCLUDED.daily_credits,
  hourly_credits = EXCLUDED.hourly_credits,
  updated_at = NOW();

-- Step 3: Create usage_hourly_quota tracking table
CREATE TABLE IF NOT EXISTS usage_hourly_quota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  license_nonce TEXT NOT NULL,
  hour_bucket BIGINT NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 0,
  requests_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, license_nonce, hour_bucket)
);

CREATE INDEX IF NOT EXISTS idx_usage_hourly_quota_hour
  ON usage_hourly_quota(hour_bucket DESC);

-- Step 4: Create atomic quota check function
CREATE OR REPLACE FUNCTION check_and_increment_quota(
  p_user_id UUID,
  p_license_nonce TEXT,
  p_credits_required INTEGER,
  p_tier TEXT DEFAULT 'BASIC'
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining_hourly INTEGER,
  remaining_daily INTEGER,
  exceeded_type TEXT
) AS $$
DECLARE
  v_hour_start BIGINT;
  v_day_start BIGINT;
  v_hourly_limit INTEGER;
  v_daily_limit INTEGER;
  v_hour_used INTEGER;
  v_day_used INTEGER;
BEGIN
  -- Calculate time buckets
  v_hour_start := EXTRACT(EPOCH FROM date_trunc('hour', NOW()))::BIGINT;
  v_day_start := EXTRACT(EPOCH FROM date_trunc('day', NOW()))::BIGINT;

  -- Get quota limits for tier
  SELECT hourly_credits, daily_credits
  INTO v_hourly_limit, v_daily_limit
  FROM quota_limits
  WHERE tier = p_tier;

  -- Handle unknown tier (default to BASIC)
  IF v_hourly_limit IS NULL THEN
    SELECT hourly_credits, daily_credits
    INTO v_hourly_limit, v_daily_limit
    FROM quota_limits WHERE tier = 'BASIC';
  END IF;

  -- Get current hourly usage (FOR UPDATE to prevent race)
  SELECT COALESCE(credits_used, 0), COALESCE(requests_used, 0)
  INTO v_hour_used, v_day_used
  FROM usage_hourly_quota
  WHERE user_id = p_user_id
    AND license_nonce = p_license_nonce
    AND hour_bucket = v_hour_start
  FOR UPDATE;

  v_hour_used := COALESCE(v_hour_used, 0);

  -- Get daily usage from hourly table
  SELECT COALESCE(SUM(credits_used), 0)
  INTO v_day_used
  FROM usage_hourly_quota
  WHERE user_id = p_user_id
    AND license_nonce = p_license_nonce
    AND hour_bucket >= v_day_start;

  v_day_used := COALESCE(v_day_used, 0);

  -- Check hourly limit
  IF v_hour_used + p_credits_required > v_hourly_limit THEN
    RETURN QUERY SELECT
      false,
      v_hourly_limit - v_hour_used,
      v_daily_limit - v_day_used,
      'hourly_credits'::TEXT;
    RETURN;
  END IF;

  -- Check daily limit
  IF v_day_used + p_credits_required > v_daily_limit THEN
    RETURN QUERY SELECT
      false,
      v_hourly_limit - v_hour_used,
      v_daily_limit - v_day_used,
      'daily_credits'::TEXT;
    RETURN;
  END IF;

  -- Atomic increment (INSERT ... ON CONFLICT DO UPDATE)
  INSERT INTO usage_hourly_quota (user_id, license_nonce, hour_bucket, credits_used, requests_used)
  VALUES (p_user_id, p_license_nonce, v_hour_start, p_credits_required, 1)
  ON CONFLICT (user_id, license_nonce, hour_bucket)
  DO UPDATE SET
    credits_used = usage_hourly_quota.credits_used + p_credits_required,
    requests_used = usage_hourly_quota.requests_used + 1;

  RETURN QUERY SELECT
    true,
    v_hourly_limit - v_hour_used - p_credits_required,
    v_daily_limit - v_day_used - p_credits_required,
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Create TypeScript Wrapper

```typescript
// File: src/lib/usage-metering/quota-checker.ts

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';

interface QuotaCheckResult {
  allowed: boolean;
  remainingHourly: number;
  remainingDaily: number;
  exceededType?: 'hourly_credits' | 'daily_credits';
}

export async function checkQuota(
  userId: string,
  licenseNonce: string,
  creditsRequired: number,
  tier: string = 'BASIC'
): Promise<QuotaCheckResult> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc('check_and_increment_quota', {
    p_user_id: userId,
    p_license_nonce: licenseNonce,
    p_credits_required: creditsRequired,
    p_tier: tier,
  });

  if (error) {
    logger.error('[Quota Checker] RPC failed', error);
    throw error;
  }

  const result = data[0] as any;
  return {
    allowed: result.allowed,
    remainingHourly: result.remaining_hourly,
    remainingDaily: result.remaining_daily,
    exceededType: result.exceeded_type as 'hourly_credits' | 'daily_credits' | undefined,
  };
}
```

### 3. Update Batch API to Use Quota Check

Update `src/app/api/v1/usage/batch/route.ts`:
- Call `checkQuota()` before inserting each record
- Return 429 with quota details when exceeded

### 4. Test Quota Function

```sql
-- Test basic quota check
SELECT check_and_increment_quota(
  'test-user-uuid'::uuid,
  'test-license-nonce',
  5,  -- credits required
  'BASIC'
);

-- Test quota exceeded (run multiple times)
-- Should return allowed=false after 20 credits
```

## Success Criteria

- [ ] `quota_limits` table created with 4 tiers
- [ ] `usage_hourly_quota` table created with unique constraint
- [ ] `check_and_increment_quota()` function works correctly
- [ ] Quota exceeded returns correct error type
- [ ] TypeScript wrapper has no compile errors
- [ ] Batch API enforces quota before ingestion

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Function locks table under high load | High | Use `FOR UPDATE` only on specific row (indexed) |
| SECURITY DEFINER privilege escalation | Medium | Grant EXECUTE only to specific roles |
| Quota limits not cached | Low | Add Redis caching layer if needed |

## Next Steps

After quota enforcement complete:
1. Proceed to Phase 03: Polar Usage Reporting
2. Load test with 100 concurrent requests
3. Verify no race conditions in quota tracking
