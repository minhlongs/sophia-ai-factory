---
title: Phase 4 - Database Schema Updates
description: Add subscription_id foreign key, linkage between licenses and subscriptions
status: pending
priority: P1
effort: 1h
---

# Phase 4: Database Schema Updates

## Overview

Add proper foreign key relationships between `raas_licenses` and subscription tables for efficient querying.

## Current Schema Issues

**Problem:** `polar_subscription_id` stored in JSONB `metadata` column
- Cannot enforce foreign key constraint
- Slow queries (JSONB extraction)
- No cascade delete/update

## Current Status

**NOT IMPLEMENTED** - License data stored in JSONB metadata column, queries work but not optimal.

## Solution

Add dedicated `polar_subscription_id` column with foreign key reference.

## Migration Steps

### Step 1: Create Migration File

**File:** `apps/sophia-ai-factory/docs/migrations/add-subscription-id-to-raas-licenses.sql`

```sql
-- Migration: Add polar_subscription_id FK to raas_licenses
-- Date: 2026-03-06
-- Description: Add proper FK relationship for subscription tracking

-- ============================================================================
-- Step 1: Add new column
-- ============================================================================

ALTER TABLE raas_licenses
ADD COLUMN polar_subscription_id TEXT;

-- ============================================================================
-- Step 2: Migrate existing data from metadata to new column
-- ============================================================================

UPDATE raas_licenses
SET polar_subscription_id = metadata->>'polar_subscription_id'
WHERE metadata->>'polar_subscription_id' IS NOT NULL;

-- ============================================================================
-- Step 3: Add index for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_raas_licenses_polar_subscription_id
  ON raas_licenses(polar_subscription_id);

-- ============================================================================
-- Step 4: Add unique constraint (one license per subscription)
-- Note: Comment out if multiple licenses per subscription allowed
-- ============================================================================

-- CREATE UNIQUE INDEX IF NOT EXISTS idx_raas_licenses_unique_subscription
--   ON raas_licenses(polar_subscription_id)
--   WHERE is_revoked = false;

-- ============================================================================
-- Step 5: Add comments
-- ============================================================================

COMMENT ON COLUMN raas_licenses.polar_subscription_id
  IS 'Polar.sh subscription ID (FK to external Polar API, not local table)';

-- ============================================================================
-- Step 6: Update RLS policies (if needed)
-- ============================================================================

-- No changes needed - existing admin policy covers new column

-- ============================================================================
-- Rollback Script
-- ============================================================================

-- DROP INDEX IF EXISTS idx_raas_licenses_polar_subscription_id;
-- ALTER TABLE raas_licenses DROP COLUMN polar_subscription_id;
```

### Step 2: Update raas-schema.ts

**File:** `src/lib/raas-schema.ts`

```typescript
export interface RaasLicense {
  id: string
  key_hash: string
  tier: LicenseTier
  expires_at: number | null
  nonce: string
  is_revoked: boolean
  revoked_at: number | null
  revoked_by: string | null
  created_by: string | null
  created_at: number
  metadata: Json
  updated_at: number | null
  polar_subscription_id: string | null  // NEW
}

export interface RaasLicenseInsert {
  key_hash: string
  tier: LicenseTier
  expires_at?: number | null
  nonce: string
  is_revoked?: boolean
  revoked_at?: number | null
  revoked_by?: string | null
  created_by?: string | null
  created_at?: number
  metadata?: Json
  polar_subscription_id?: string | null  // NEW
}
```

### Step 3: Update raas-audit.ts Functions

**File:** `src/lib/raas-audit.ts`

Update `createLicense()` to accept `polarSubscriptionId`:

```typescript
interface LicenseCreationParams {
  tier: Tier
  nonce: string
  keyHash: string
  expiresAt: number
  createdBy?: string
  metadata?: Record<string, unknown>
  polarSubscriptionId?: string  // NEW
}

export async function createLicense(params: LicenseCreationParams): Promise<RaasLicense> {
  const supabase = createAdminClient()
  const createdAt = Math.floor(Date.now() / 1000)

  const licenseData: RaasLicenseInsert = {
    key_hash: params.keyHash,
    tier: params.tier as string,
    nonce: params.nonce,
    expires_at: params.expiresAt,
    created_at: createdAt,
    created_by: params.createdBy ?? null,
    metadata: (params.metadata ?? {}) as Json,
    is_revoked: false,
    polar_subscription_id: params.polarSubscriptionId ?? null,  // NEW
  }

  // ... rest of function
}
```

### Step 4: Update Query Functions

Update `getLicenseBySubscriptionId()`:

```typescript
/**
 * Get license by Polar subscription ID
 */
export async function getLicenseBySubscriptionId(
  polarSubscriptionId: string
): Promise<RaasLicense | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('raas_licenses')
    .select('*')
    .eq('polar_subscription_id', polarSubscriptionId)
    .single()

  if (error && error.code !== 'PGRST116') {
    logger.error(`Failed to fetch license for subscription ${polarSubscriptionId}`, error)
    throw new Error(`Database error: ${error.message}`)
  }

  return data
}
```

### Step 5: Update supabase/types.ts

Regenerate Supabase types after schema change:

```bash
cd apps/sophia-ai-factory
npx supabase gen types typescript --project-id <project-id> > src/lib/supabase/types.ts
```

Or manually add:

```typescript
// In raas_licenses row type
polar_subscription_id: string | null
```

## Success Criteria

- [ ] Migration runs without errors
- [ ] Existing data migrated from `metadata` to `polar_subscription_id` column
- [ ] Index created for performance
- [ ] TypeScript types updated
- [ ] All existing queries still work

## Rollback Plan

If migration fails:

```sql
-- Rollback
DROP INDEX IF EXISTS idx_raas_licenses_polar_subscription_id;
ALTER TABLE raas_licenses DROP COLUMN polar_subscription_id;
```

## Testing

```typescript
describe('getLicenseBySubscriptionId', () => {
  it('finds license by polar_subscription_id', async () => {
    // Create test license
    await createLicense({
      tier: 'PREMIUM',
      nonce: 'test-nonce',
      keyHash: 'test-hash',
      expiresAt: 0,
      polarSubscriptionId: 'sub_test_123',
    })

    // Query by subscription ID
    const license = await getLicenseBySubscriptionId('sub_test_123')
    expect(license).toBeDefined()
    expect(license?.polar_subscription_id).toBe('sub_test_123')
  })
})
```

## Next Steps

To implement Phase 4:

1. **Run migration SQL** to add `polar_subscription_id` column
2. **Update `raas-schema.ts`** with new interface fields
3. **Regenerate Supabase types** after schema change
4. **Update all queries** to use new column where possible
