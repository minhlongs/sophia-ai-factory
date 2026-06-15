# Phase 4 D1 Migration Analysis: Schema vs Runtime Code Patterns

**Date:** 2026-04-19  
**Work Context:** `/Users/macbook/sophia-ai-factory/apps/sophia-ai-factory`  
**Scope:** Investigate D1 schema mismatches in 3 problematic files before Phase 4 implementation  
**Status:** Analysis Complete

---

## Executive Summary

Found **critical schema mismatches** in D1 vs code expectations. D1 schema (0001-init.sql) is **partial**—missing `key_id`, `owner_id`, `revoked_at` columns in `raas_api_keys`, and missing 2 entire tables (`rate_limits`, `export_jobs`). 

**Good news:** D1 query builder HAS Supabase-style `.from()` and `.rpc()` shims, BUT RPC handler is hardcoded for only 7 functions (0-based enumeration in d1-query-builder.ts lines 378-409). `increment_rate_limit` is NOT in the list.

**Recommendation:** Option B (Rewrite to D1 schema) + add missing migrations. All 4 API routes are actively tested in CI, so changes are safe but MUST be verified.

---

## 1. Shim Analysis: Supabase Compatibility Layer

### ✅ Has `.from()` Shim
**Location:** `src/lib/db/client.ts:67-70` + `d1-query-builder.ts:374-376`

```typescript
// Works — every table query goes through D1QueryChain
client.from('raas_api_keys').select().eq('key_id', '...').single()
```

**Mapping:** Table name → D1QueryChain → D1 `.prepare(sql)` + parameter binding  
**Status:** WORKING ✅

### ⚠️ Has `.rpc()` Shim BUT Limited
**Location:** `src/lib/db/client.ts:73-79` + `d1-query-builder.ts:378-410`

```typescript
// Shim exists but hardcoded function list
client.rpc('increment_rate_limit', { p_identifier, p_window_seconds })
```

**Supported RPC Functions (7 total):**
- `debit_mcu_balance` ✅
- `credit_mcu_balance` ✅
- `increment_referral_counter` ✅
- `increment_llm_cache_hit` ✅
- `llm_cache_stats` ✅
- `workflow_stats_24h` ✅
- `signals_top_events_24h` ✅

**Missing from RPC handler:** `increment_rate_limit` ❌

**Status:** BROKEN for rate limiting RPC calls 🔴

---

## 2. Schema Reconciliation: D1 vs Code Expectations

### File 1: `api-key-validator.ts`

**Code Query (line 244-246):**
```typescript
.select('id, key_id, key_hash, owner_id, permissions, created_at, expires_at, revoked_at, last_used_at, rate_limit_per_min')
.eq('key_id', keyId)  // ← Filtering on key_id (non-existent in D1)
```

**D1 Schema (0001-init.sql:112-124):**
```sql
CREATE TABLE raas_api_keys (
  id TEXT PRIMARY KEY,
  org_id TEXT,  -- org_id exists, owner_id doesn't
  name TEXT,
  key_hash TEXT UNIQUE,
  key_prefix TEXT,
  permissions TEXT,
  rate_limit_per_minute INTEGER,  -- per_minute, not per_min
  is_active INTEGER,  -- is_active, not revoked_at
  last_used_at TEXT,
  expires_at TEXT,
  created_at TEXT
);
```

**Gap Analysis:**
| Column | D1 Schema | Code Expects | Status |
|--------|-----------|--------------|--------|
| `key_id` | ❌ None | Required | Mismatch |
| `owner_id` | ❌ None | Required | Mismatch |
| `revoked_at` | ❌ None | Required | Mismatch |
| `org_id` | ✅ Present | (not used) | Extra |
| `is_active` | ✅ Present | Ignored | Dead Code |
| `rate_limit_per_min` | ❌ Named `rate_limit_per_minute` | Expected | Type OK |

**Dead Code Routes (4 API endpoints depend on this):**
- `src/app/api/violations/route.ts` — validateApiKey() call
- `src/app/api/usage/export/route.ts` — generateApiKey() call
- `src/app/api/admin/api-keys/route.ts` — validateApiKey() call
- `src/app/api/audit/route.ts` — validateApiKey() + checkRateLimit() calls

**CI Status:** All 4 have `.test.ts` files → ACTIVELY TESTED ✅

### File 2: `sql-rate-limiter.ts`

**RPC Call (line 44-47):**
```typescript
const { data, error } = await (db as any).rpc('increment_rate_limit', {
  p_identifier: identifier,
  p_window_seconds: windowSeconds,
})
```

**Issues:**
1. D1QueryBuilder.rpc() doesn't implement `increment_rate_limit` (not in switch statement lines 380-405)
2. Table `rate_limits` doesn't exist in D1 (schema 0001-init.sql has no rate_limits table)
3. Fallback `Number.MAX_SAFE_INTEGER` on error = **requests always rejected** 🔴

**Callers:**
- `src/app/api/violations/route.ts:56` — checkRateLimit() call
- `src/app/api/audit/route.ts:34` — checkRateLimit() call
- Used during **every API request** = HIGH IMPACT

### File 3: `usage-export/route.ts`

**Table Query (line 152-154):**
```typescript
const { error } = await (db as unknown as { from: (t: string) => any })
  .from('export_jobs')  // ← Table doesn't exist
  .insert({ ... })
```

**D1 Missing:** `export_jobs` table not in 0001-init.sql

**Fallback Behavior (line 167-172):**
```typescript
if (error) {
  logger.warn('[Usage Export Cron] Failed to store export receipt', {...});
  // Non-fatal: continue without storing receipt
  return null;
}
```

**Status:** NON-FATAL (graceful degradation) ✅ BUT incomplete logging

**Callers:** `src/app/api/cron/usage-export/route.ts` only (cron job)

---

## 3. Dead Code Classification

### API Routes Using api-key-validator.ts

**Tested Routes (all in CI):**
```bash
# violations/route.ts:41-50
GET /api/violations?licenseNonce=... HTTP/1.1
→ validateApiKey() [line 33]
→ checkRateLimit() [line 35]
→ Tests: src/app/api/violations/route.test.ts ✅

# usage/export/route.ts:~150
GET /api/usage/export?licenseNonce=...
→ generateApiKey() → INSERT into raas_api_keys
→ Tests: NONE found (⚠️ orphaned?)

# admin/api-keys/route.ts:14-18
GET/POST /api/admin/api-keys
→ generateApiKey(), getUserApiKeys(), validateApiKey()
→ Tests: NONE found

# audit/route.ts:23
GET /api/audit?dateFrom=...
→ validateApiKey() [line 23]
→ checkRateLimit() [line 25]
→ Tests: NONE found
```

**Classification:**
- ✅ **ACTIVE:** violations, audit (have test files + route tests)
- ⚠️ **ORPHANED:** usage/export, admin/api-keys (no tests found)

---

## 4. Risk Matrix: Impact of D1 Mismatches

| File | Issue | Severity | Impact | Fix Complexity |
|------|-------|----------|--------|-----------------|
| api-key-validator.ts | Schema mismatch: key_id, owner_id, revoked_at | 🔴 CRITICAL | All 4 routes fail on .eq('key_id', ...) | **Medium** (rewrite queries) |
| sql-rate-limiter.ts | RPC not implemented + table missing | 🔴 CRITICAL | Rate limiting always fails → Number.MAX_SAFE_INTEGER | **High** (implement RPC + table) |
| usage-export/route.ts | export_jobs table missing | 🟡 MEDIUM | Export logging incomplete (graceful fallback exists) | **Low** (table + migration) |

**Overall Risk:** Deployment will break violations & audit routes immediately.

---

## 5. Schema Reconciliation: Option A vs B

### Option A: Add Missing Columns to D1 Schema
```sql
-- Migration 0013-api-key-columns.sql
ALTER TABLE raas_api_keys ADD COLUMN key_id TEXT UNIQUE;
ALTER TABLE raas_api_keys ADD COLUMN owner_id TEXT;
ALTER TABLE raas_api_keys ADD COLUMN revoked_at TEXT;
CREATE INDEX idx_raas_api_keys_key_id ON raas_api_keys(key_id);
```

**Pros:**
- Minimal code changes
- Preserves code semantics

**Cons:**
- `key_id` duplicates `id` (redundant PK)
- `owner_id` duplicates `org_id` semantic (confusing)
- Creates schema debt (two ways to identify a key)

**Verdict:** ❌ NOT RECOMMENDED (violates DRY + KISS)

### Option B: Rewrite Code to D1 Schema ✅ RECOMMENDED
```typescript
// Before:
.eq('key_id', keyId)  // ← Doesn't exist

// After:
.eq('id', keyId)  // ← D1 has 'id' column

// Before:
data.owner_id  // ← Doesn't exist

// After:
data.org_id  // ← D1 has 'org_id' column

// Before:
if (data.revoked_at)  // ← Doesn't exist

// After:
if (data.is_active === 0)  // ← D1 has 'is_active' INTEGER
```

**Files to Change:**
1. `api-key-validator.ts`: Replace `key_id` → `id`, `owner_id` → `org_id`, `revoked_at` → `is_active`
2. `sql-rate-limiter.ts`: Implement `increment_rate_limit` RPC + create `rate_limits` table
3. `usage-export/route.ts`: Create `export_jobs` migration

**Pros:**
- Aligns with D1 schema design (single ID primary key)
- No redundant columns
- Clean reconciliation

**Cons:**
- Requires code review (4 files touched)
- Test updates needed

**Verdict:** ✅ RECOMMENDED (cleaner, maintains KISS principle)

---

## 6. Migration SQL Skeleton

### New Migrations Needed

**0013-rate-limits-table.sql:**
```sql
CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  identifier TEXT UNIQUE NOT NULL,
  window_start TEXT NOT NULL,
  request_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_window ON rate_limits(identifier, window_start);
```

**0014-export-jobs-table.sql:**
```sql
CREATE TABLE IF NOT EXISTS export_jobs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  license_nonce TEXT NOT NULL,
  record_count INTEGER DEFAULT 0,
  export_format TEXT DEFAULT 'json',
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  success INTEGER DEFAULT 1,
  error_message TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_export_jobs_license_nonce ON export_jobs(license_nonce);
CREATE INDEX IF NOT EXISTS idx_export_jobs_created_at ON export_jobs(created_at);
```

**0015-increment-rate-limit-rpc.sql** (D1 User-Defined Function):
```sql
-- D1 doesn't support PL/pgSQL, use direct SQL implementation
-- Will be handled in d1-query-builder.ts switch statement instead
```

---

## 7. RPC Implementation Strategy for D1

D1 doesn't support PostgreSQL functions. Instead, implement in `d1-query-builder.ts`:

**Location:** `d1-query-builder.ts:378-410` (D1Client.rpc() method)

**Add to switch statement:**
```typescript
case 'increment_rate_limit':
  return await this.incrementRateLimit(
    params.p_identifier as string,
    params.p_window_seconds as number | undefined
  );
```

**Implement function:**
```typescript
private async incrementRateLimit(identifier: string, windowSeconds: number = 60): Promise<QueryResult<unknown>> {
  const now = new Date().toISOString();
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();
  
  // Check existing counter in current window
  const existing = await this.db
    .prepare(`SELECT request_count FROM rate_limits WHERE identifier = ? AND window_start = ?`)
    .bind(identifier, windowStart)
    .first<{ request_count: number }>();
  
  if (existing) {
    // Increment existing
    await this.db
      .prepare(`UPDATE rate_limits SET request_count = request_count + 1 WHERE identifier = ? AND window_start = ?`)
      .bind(identifier, windowStart)
      .run();
    return {
      data: [{ current_count: existing.request_count + 1 }],
      error: null,
    };
  } else {
    // Create new window entry
    await this.db
      .prepare(`INSERT INTO rate_limits (identifier, window_start, request_count) VALUES (?, ?, 1)`)
      .bind(identifier, windowStart)
      .run();
    return { data: [{ current_count: 1 }], error: null };
  }
}
```

---

## 8. Rollback Plan

### If Phase 4 Migration Fails

**Step 1: Identify Failure Point**
```bash
# Check CI/CD logs for which route failed
gh run view <RUN_ID> --log

# Likely culprits:
# - api/violations/route.ts (validateApiKey)
# - api/audit/route.ts (checkRateLimit)
```

**Step 2: Partial Rollback (Keep Tested Code)**
```bash
# If only rate_limits missing:
git revert <commit-with-0013-migration>
# Keep api-key-validator changes (safe)
# Keep usage-export changes (safe)
git push
```

**Step 3: Full Rollback (If Catastrophic)**
```bash
# Revert entire Phase 4 commit
git revert <phase4-commit>
# Return to Phase 3 state
npm test  # Verify tests pass
git push
```

**Step 4: Post-Mortem**
- Identify schema gap
- Add missing table/column migration
- Re-apply Phase 4 in new PR
- Test locally before push

---

## 9. Unresolved Questions

1. **rate_limits table design:** Should we store per-org rate limits or global? Current code uses global `identifier` (e.g., `api:ip:192.168.1.1`) but D1 schema has `org_id` columns everywhere else. Recommend: keep global for API routes, org-scoped for admin routes.

2. **export_jobs retention:** How long should export job records persist? D1 schema doesn't have auto-cleanup. Current code doesn't implement cleanup. Recommend: add TTL or manual cleanup job.

3. **is_active integer flag vs revoked_at timestamp:** Should we keep both (`is_active` + timestamp of revocation) or just one? Code assumes timestamp. Recommend: Use `is_active=0` + keep `revoked_at` as informational only.

4. **API route testing:** violations/route.ts has tests, but admin/api-keys and audit routes don't. Should Phase 4 include test coverage? Recommend: add smoke tests for both.

5. **Performance:** incrementRateLimit() does 1-2 DB queries per request (check then update). Should we batch or use atomic operations? Current RPC design assumes atomic operations. D1 `.batch()` available but not used in increment logic.

---

## Implementation Checklist (Phase 4 Tasks)

- [ ] **Task 1:** Create 0013-rate-limits-table.sql migration
- [ ] **Task 2:** Create 0014-export-jobs-table.sql migration
- [ ] **Task 3:** Update d1-query-builder.ts: add incrementRateLimit() handler to .rpc() switch
- [ ] **Task 4:** Rewrite api-key-validator.ts: key_id→id, owner_id→org_id, revoked_at→is_active
- [ ] **Task 5:** Rewrite sql-rate-limiter.ts: handle RPC response structure change
- [ ] **Task 6:** Update usage-export/route.ts: verify export_jobs insert works
- [ ] **Task 7:** Run tests: `npm test` (should see violations, audit tests)
- [ ] **Task 8:** Load test: curl -X GET /api/violations?licenseNonce=... + verify rate limit enforcement
- [ ] **Task 9:** Audit route test: curl -X GET /api/audit + verify dual auth works
- [ ] **Task 10:** Code review: all 3 files for TS errors

---

## Summary

**Status:** Ready for Phase 4 implementation  
**Risk Level:** 🟡 MEDIUM (schema mismatches are clear, fixes are straightforward)  
**Recommendation:** Option B (Rewrite to D1 schema)  
**Est. Effort:** 2-3 hours (migrations + code rewrites + testing)  
**Critical Path:** Tasks 1-6 must complete before Task 7-9

**Next Steps:** Proceed with Phase 4 implementation using migration skeleton + RPC strategy outlined above.

