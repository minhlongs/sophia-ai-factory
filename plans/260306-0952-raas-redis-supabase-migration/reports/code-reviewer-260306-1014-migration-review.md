# Code Review: Redis → Supabase Migration

## Scope

- **Files reviewed:**
  - `src/lib/raas-audit.ts` (480 lines)
  - `src/lib/raas-schema.ts` (163 lines)
  - `scripts/migrate-redis-to-supabase.ts` (308 lines)
  - `docs/migrations/raas-licenses-schema.sql` (156 lines)
  - `src/app/api/admin/licenses/middleware.ts` (41 lines)
  - `src/app/api/admin/licenses/route.ts` (46 lines)
  - `src/app/api/admin/licenses/[id]/route.ts` (130 lines)
  - `src/app/api/admin/licenses/create/route.ts` (124 lines)
  - `src/app/api/admin/licenses/audit/route.ts` (46 lines)
  - `src/app/api/admin/licenses/list.test.ts` (236 lines)
- **Lines analyzed:** ~1,700
- **Review focus:** Redis→Supabase migration implementation
- **Updated plans:** `plans/260306-0952-raas-redis-supabase-migration/plan.md`

---

## Overall Assessment

Migration implementation is **solid and production-ready** with well-structured service layer, proper authentication, and comprehensive audit logging. Code follows established patterns with good separation of concerns. However, there are **critical type safety issues** and **security gaps** that must be addressed before merge.

**Quality Score: 7/10** (Good foundation, needs fixes)

---

## Critical Issues (Must Fix Before Merge)

### 1. Type Safety Violations in raas-audit.ts

**Issue:** Multiple `:any` types defeat TypeScript safety, especially in database operations.

**Locations:**
```typescript
// Line 89-91: Insert operation
const { data, error } = await supabase
  .from('raas_licenses')
  .insert(licenseData as any)  // ❌ any
  .select()
  .single() as any             // ❌ any

// Line 218: Update operation
const { data, error } = await (supabase.from('raas_licenses') as any)  // ❌ any

// Line 267: Audit log insert
const { error } = await supabase
  .from('raas_audit_logs')
  .insert(logData as any) as any  // ❌ any x2

// Line 434: Metadata update
const { error } = await (supabase.from('raas_licenses') as any)  // ❌ any
```

**Impact:** No type checking on database operations. Schema changes won't be caught at compile time.

**Fix:**
```typescript
// Use proper typing with Supabase generated types
// If using supabase gen:types, import generated types:
import type { Database } from '@/lib/supabase/database-types'

// Then use:
const { data, error } = await supabase
  .from('raas_licenses')
  .insert(licenseData)  // No 'as any'
  .select()
  .single()

// Or define explicit types for insert/select:
type LicenseInsert = Database['public']['Tables']['raas_licenses']['Insert']
type LicenseRow = Database['public']['Tables']['raas_licenses']['Row']
```

---

### 2. SQL Injection Risk in Query Building

**Issue:** Dynamic query building with user input in `getLicenses()` without proper sanitization.

**Location:** `raas-audit.ts` lines 147-149:
```typescript
} else if (status === 'active') {
  query = query.eq('is_revoked', false).or(`expires_at.is.null,expires_at.gt.${now}`)
}
```

**Impact:** The `.or()` method with template string interpolation could be vulnerable if `now` is manipulated (though currently safe as it's generated server-side).

**Fix:** Use Supabase's filter methods instead of string interpolation:
```typescript
// Better approach - use separate filters
query = query
  .eq('is_revoked', false)
  .or('expires_at.is.null')
  .or(`expires_at.gt.${now}`)  // now is server-generated, safe
```

**Current code is SAFE** because `now` is server-generated, but add comment for future maintainers.

---

### 3. Missing Input Validation on API Routes

**Issue:** API routes trust query parameters without validation.

**Location:** `src/app/api/admin/licenses/route.ts`:
```typescript
const page = parseInt(searchParams.get('page') || '1', 10)
const limit = parseInt(searchParams.get('limit') || '20', 10)
```

**Impact:** No bounds checking. User could request `page=-1` or `limit=999999` causing performance issues.

**Fix:** Add validation with Zod:
```typescript
import { z } from 'zod'

const licenseListSchema = z.object({
  tier: z.enum(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']).optional(),
  search: z.string().max(100).optional(),
  status: z.enum(['active', 'revoked', 'expired']).optional(),
  page: z.coerce.number().int().positive().max(1000).default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
})

// In GET handler:
const parsed = licenseListSchema.parse(Object.fromEntries(searchParams))
```

---

### 4. Migration Script Security: Placeholder Key Hash

**Issue:** Migration script creates fake key hashes.

**Location:** `scripts/migrate-redis-to-supabase.ts` lines 106-108:
```typescript
const keyHash = createHash('sha256')
  .update(`migrated:${nonce}`)
  .digest('hex')
```

**Impact:** Migrated licenses cannot be validated by original key! Validation will fail because hash doesn't match.

**Fix Options:**

**Option A:** If original keys are stored elsewhere:
```typescript
// Fetch actual key from secure storage (if available)
const originalKey = await getOriginalKeyFromVault(nonce)
const keyHash = createHash('sha256').update(originalKey).digest('hex')
```

**Option B:** If keys are lost, document this breaking change:
```typescript
// MIGRATION NOTE: Original keys not available in Redis
// Validation will require key regeneration for migrated licenses
metadata: {
  ...data.metadata,
  migrated: true,
  migratedAt: Math.floor(Date.now() / 1000),
  requiresKeyRegeneration: true  // Flag for manual follow-up
}
```

---

## Major Issues (Should Fix)

### 5. Unused Type Definitions

**Issue:** Defined but never used interfaces create dead code.

**Location:** `raas-audit.ts`:
```typescript
interface LicenseValidationParams { ... }  // Line 38 - unused
interface LicenseRevocationParams { ... }  // Line 46 - unused
```

**Fix:** Remove unused interfaces or implement them.

---

### 6. Inconsistent Error Handling Pattern

**Issue:** Some functions throw on error, others silently fail.

**Examples:**
```typescript
// createLicense() - throws on error (line 95)
throw new Error(`Database error: ${error.message}`)

// logAuditAction() - silently ignores error (line 270-272)
if (error) {
  logger.error('Failed to log audit action', error)
  // Don't throw - audit logging failure shouldn't block main operation
}
```

**Impact:** Inconsistent behavior makes it hard to know when operations fail.

**Fix:** Standardize with clear documentation:
```typescript
/**
 * Log an audit action
 * Note: Failures are logged but not thrown - audit logging is non-blocking
 */
export async function logAuditAction(params: AuditLogParams): Promise<void> {
  // ... existing code
  if (error) {
    logger.error('Failed to log audit action', error)
    // Audit failure should not block main operation
    return  // Explicit return for clarity
  }
}
```

---

### 7. N+1 Query Pattern in Validation Count Increment

**Issue:** `incrementValidationCount()` does SELECT then UPDATE.

**Location:** `raas-audit.ts` lines 421-443:
```typescript
export async function incrementValidationCount(nonce: string): Promise<void> {
  const license = await getLicenseByNonce(nonce)  // SELECT 1
  if (!license) return

  const currentMetadata = license.metadata as { validateCount?: number } || {}
  const newCount = (currentMetadata.validateCount || 0) + 1

  const { error } = await supabase
    .from('raas_licenses')
    .update({ metadata: { ...currentMetadata, validateCount: newCount } })
    .eq('nonce', nonce)  // UPDATE 1
}
```

**Impact:** Two database round-trips per validation. Under load, this becomes a bottleneck.

**Fix:** Use atomic increment with PostgreSQL:
```typescript
// Option A: Use RPC function for atomic increment
const { error } = await supabase.rpc('increment_validation_count', {
  p_nonce: nonce
})

// Create SQL function:
// CREATE OR REPLACE FUNCTION increment_validation_count(p_nonce TEXT)
// RETURNS void AS $$
// BEGIN
//   UPDATE raas_licenses
//   SET metadata = jsonb_set(
//     COALESCE(metadata, '{}'::jsonb),
//     '{validateCount}',
//     to_jsonb(COALESCE((metadata->>'validateCount')::int, 0) + 1)
//   )
//   WHERE nonce = p_nonce;
// END;
// $$ LANGUAGE plpgsql;

// Option B: Use raw SQL via Supabase
const { error } = await supabase.rpc('raw_sql', {
  query: `
    UPDATE raas_licenses
    SET metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{validateCount}',
      to_jsonb(COALESCE((metadata->>'validateCount')::int, 0) + 1)
    )
    WHERE nonce = $1
  `,
  params: [nonce]
})
```

---

### 8. Missing Index on expires_at for Expiration Queries

**Issue:** Schema has indexes but missing composite index for active license queries.

**Location:** `docs/migrations/raas-licenses-schema.sql`:
```sql
-- Current indexes
CREATE INDEX idx_raas_licenses_nonce ON raas_licenses(nonce);
CREATE INDEX idx_raas_licenses_is_revoked ON raas_licenses(is_revoked);

-- Missing: composite index for status=active queries
```

**Impact:** Query on lines 147-149 does `.eq('is_revoked', false).or('expires_at...')` - could be slow on large datasets.

**Fix:** Add composite index:
```sql
-- Add to schema migration
CREATE INDEX IF NOT EXISTS idx_raas_licenses_active_status
  ON raas_licenses(is_revoked, expires_at)
  WHERE is_revoked = false;
```

Note: This is already in the schema (line 62-63) but verify it's created.

---

## Minor Issues (Optional)

### 9. Tier Enum Mismatch Risk

**Issue:** `LicenseTier` in schema uses uppercase, but API accepts lowercase and converts.

**Location:**
- `raas-schema.ts` line 18: `export type LicenseTier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER'`
- `create/route.ts` line 30-37: Converts to uppercase

**Impact:** Potential confusion for API consumers.

**Fix:** Add documentation comment:
```typescript
/**
 * License Tier Enum
 * API accepts case-insensitive values, stored as UPPERCASE
 */
export type LicenseTier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER'
```

---

### 10. Hardcoded 'admin' String

**Issue:** Multiple places use hardcoded `'admin'` string for createdBy.

**Locations:**
- `create/route.ts` line 89: `createdBy: 'admin'`
- `[id]/route.ts` line 103: `revokedBy: 'admin'`

**Fix:** Extract to constant:
```typescript
// In middleware.ts or config file
export const SYSTEM_ADMIN_ID = 'admin' as const

// Use in routes
createdBy: SYSTEM_ADMIN_ID
```

Better: Use actual admin user UUID from authentication.

---

### 11. Test File: Mock Data Doesn't Match Real Schema

**Issue:** Test file uses simplified mock data that doesn't validate against real schema.

**Location:** `list.test.ts` lines 11-32:
```typescript
const mockResponse = {
  licenses: [{
    id: 'license-001',
    tier: 'basic',  // Should be 'BASIC' (uppercase per schema)
    // ...
  }],
  // ...
}
```

**Impact:** Tests pass but don't catch real schema mismatches.

**Fix:** Import and use real types in tests:
```typescript
import type { LicenseSummary } from '@/lib/raas-schema'

const mockResponse: LicenseListResponse = {
  licenses: [{
    id: 'license-001',
    tier: 'BASIC',  // TypeScript enforces uppercase
    // ...
  }],
  // ...
}
```

---

### 12. Logging: Sensitive Data Exposure Risk

**Issue:** Logging license nonces in plain text could leak to logs.

**Locations:**
- `raas-audit.ts` line 114: `logger.error(`Failed to fetch license ${nonce}`, error)`
- `raas-audit.ts` line 135: `logger.info(`Migrated license ${nonce} (${data.tier})`)`

**Impact:** If logs are exposed, license nonces could be harvested.

**Fix:** Hash nonces in logs:
```typescript
import { createHash } from 'crypto'

const logNonce = (nonce: string) =>
  createHash('sha256').update(nonce).digest('hex').substring(0, 8)

logger.info(`Migrated license ${logNonce(nonce)} (${data.tier})`)
```

---

## Positive Observations

1. **Good separation of concerns:** Service layer (`raas-audit.ts`) properly abstracts database operations from API routes.

2. **Comprehensive audit logging:** Every license operation (CREATE, VALIDATE, REVOKE) is logged with user context.

3. **Proper authentication:** All admin routes use `checkAdminAuth()` middleware consistently.

4. **Well-documented SQL:** Schema file includes comments, proper indexing strategy, and RLS policies.

5. **Migration script has verification:** Built-in count verification ensures data integrity.

6. **Pagination implemented:** API returns paginated results with proper metadata (total, totalPages).

7. **JSONB for metadata:** Flexible schema for tier-specific custom fields.

---

## Recommended Actions

### Before Merge (Critical):

1. **Remove all `:any` types** in `raas-audit.ts` - Use generated Supabase types or proper interfaces.

2. **Fix migration script key hash issue** - Either fetch real keys or document breaking change.

3. **Add input validation** with Zod on all API route query parameters.

4. **Remove unused interfaces** (`LicenseValidationParams`, `LicenseRevocationParams`).

### After Merge (Important):

5. **Optimize `incrementValidationCount()`** - Implement atomic RPC function.

6. **Add bounds checking** on pagination parameters.

7. **Document tier case handling** - Add comments about uppercase conversion.

8. **Enhance test coverage** - Use real types in tests, add integration tests.

---

## Security Audit Summary

| Category | Status | Notes |
|----------|--------|-------|
| SQL Injection | Safe | Server-side generated values only |
| Auth Check | Good | All routes protected by Basic Auth |
| Input Validation | Needs Work | No bounds checking on pagination |
| Type Safety | Needs Work | 8 `:any` types in critical code |
| Secrets Handling | Good | Uses env vars, no hardcoded keys |
| Audit Logging | Excellent | Comprehensive trail |
| RLS Policies | Good | Admin-only access configured |

---

## Unresolved Questions

1. **Key Storage:** Where are the original full license keys stored? Redis only had metadata, not full keys. How will validation work?

2. **Redis Decommission:** After migration, should Redis be kept as cache layer or removed entirely?

3. **Audit Retention:** How long should audit logs be retained? (30 days / 1 year / infinite)

4. **User-facing Audit:** Should non-admin users be able to view audit logs for their own licenses?

5. **Backup Strategy:** Is Supabase's automated backup sufficient, or do we need additional off-site backups?

---

## Lint Errors Summary

```
Total: 41 errors, 12 warnings

Migration-specific errors:
- src/lib/raas-audit.ts: 6 errors (all :any types), 2 warnings (unused types)
- src/app/api/admin/licenses/[id]/route.ts: 1 warning (unused var)
- src/app/api/admin/licenses/create/route.ts: 1 warning (unused var)
- src/app/api/admin/licenses/list.test.ts: 1 warning (unused var)
```

---

**Recommendation: Request Changes** - Address critical issues (especially `:any` types and key hash migration) before merge.
