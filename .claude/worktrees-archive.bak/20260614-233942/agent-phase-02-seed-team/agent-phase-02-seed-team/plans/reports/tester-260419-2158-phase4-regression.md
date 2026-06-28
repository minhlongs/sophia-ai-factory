# Phase 4 Regression Test Report
**Date:** 2026-04-19 | **Duration:** 8.33s | **Runner:** Vitest v4.1.1

---

## Test Results Summary

| Metric | Count | Status |
|--------|-------|--------|
| **Test Files** | 107 | 3 failed, 103 passed, 1 skipped |
| **Total Tests** | 1328 | 9 failed, 1288 passed, 31 skipped |
| **Pass Rate** | 97.5% | ❌ REGRESSION (baseline: 1291 passed) |

---

## Delta vs Phase 3 Baseline

- **Phase 3 Baseline:** 1291 pass, 6 fail (better-auth cascade), 31 skip
- **Phase 4 Current:** 1288 pass, 9 fail, 31 skip
- **Change:** -3 tests (REGRESSION)
- **Root Cause:** Schema migration (Supabase → D1) test mocks NOT updated

---

## Failed Tests (9 total)

### CATEGORY A: Schema Mismatch Failures (3 tests)
**File:** `src/lib/security/api-key-validator.test.ts`
**Root:** Tests use OLD Supabase schema; code uses NEW D1 canonical schema.

1. ❌ `should return valid result for existing key` (line 202)
   - **Error:** `expected false to be true`
   - **Cause:** Mock data has `key_id`, `owner_id`, `revoked_at` (Supabase), but code expects `id`, `org_id`, `is_active` (D1)
   - **Status:** Expected failure from Phase 4 edits ✓

2. ❌ `should return expired for expired key` (line 257)
   - **Error:** `expected 'revoked' to be 'expired'`
   - **Cause:** D1 `is_active` column check happens BEFORE `expires_at` check; mock doesn't set `is_active=1`
   - **Status:** Expected from Phase 4 schema reorder ✓

3. ❌ `should return array of API keys for user` (line 361)
   - **Error:** `expected '1' to be '0123456789abcdef'`
   - **Cause:** Mock data returns `id: '1'` (hardcoded), code expects `data.id` to match `keyId` from param
   - **Status:** Expected from Phase 4 edits ✓

### CATEGORY B: Better Auth Import Failures (6 tests)
**Files:** 
- `src/lib/signals/signals.test.ts` (4 failures)
- `src/app/api/v1/usage/route.test.ts` (2 failures)

**Root:** `src/lib/better-auth-server.ts` imports `better-auth` package, but Vitest fails to resolve.

Errors:
```
Error: Failed to resolve import "better-auth" from "src/lib/better-auth-server.ts"
```

**Affected Tests (Pre-existing, NOT Phase 4):**
- `(b) rejects unauthenticated request → 401`
- `(c) accepts valid CRON_SECRET bearer`
- `(d) accepts valid Better Auth session via direct requireAuth logic`
- `rejects wrong bearer token → 401`
- `/api/v1/usage API > POST - Batch Ingestion` (2 tests)

**Status:** Pre-existing (better-auth cascade from Phase 3) ✓

---

## Phase 4 Files Touched vs Test Coverage

| File Modified | Tests Found | Status |
|---|---|---|
| `migrations/0013-rate-limits.sql` | ❌ No tests | N/A (schema-only) |
| `migrations/0014-export-jobs.sql` | ❌ No tests | N/A (schema-only) |
| `src/lib/db/d1-query-builder.ts` | ✓ `workflow-repository.test.ts` (24 pass) | PASS |
| `src/lib/security/api-key-validator.ts` | ❌ 3/26 fail (api-key-validator.test.ts) | **REGRESS** |
| `src/lib/security/sql-rate-limiter.ts` | ❌ No direct tests | N/A |
| `src/app/api/cron/usage-export/route.ts` | ❌ No tests found | N/A |

---

## Critical Findings

### NEW REGRESSIONS (Phase 4 induced):
1. **Schema migration incomplete in tests** — `api-key-validator.test.ts` mocks use old Supabase columns
   - `key_id` → `id`
   - `owner_id` → `org_id`
   - `revoked_at` + `expires_at` logic → `is_active` + `expires_at` check order
   - **Impact:** 3 new failures in validation logic tests

2. **Test coverage gap** — No tests for:
   - `migrations/0013-rate-limits.sql` (new RPC ops)
   - `migrations/0014-export-jobs.sql` (batch export)
   - `sql-rate-limiter.ts` integration with typed RPC
   - `cron/usage-export/route.ts` new export logic

### PRE-EXISTING (Phase 3, NOT Phase 4):
- 6 better-auth import failures (cascade from auth refactor)
- These were baseline failures before Phase 4

---

## Test Coverage Assessment

**Phase 4 test injection:** LOW
- Rate limiter migrations: 0% coverage (schema-only, no test fixtures)
- Export jobs migration: 0% coverage
- Cron route edits: 0% coverage
- API key validator edits: Partial (3/26 tests regressed due to schema)

**Backward compatibility:** DEGRADED
- `ApiKeyInfo` aliases (`keyId`/`ownerId`) preserved ✓
- Test mocks do NOT follow alias path → discover bugs early ⚠️

---

## Verdict

**STATUS: REGRESS** ❌

**Reason:** Phase 4 schema migration introduced 3 new test failures in api-key-validator.test.ts due to mock data using old Supabase schema instead of D1 canonical schema.

**Confidence:** HIGH
- New failures directly caused by Phase 4 edits (schema rename)
- Pre-existing 6 better-auth failures unrelated to Phase 4

---

## Actionable Fixes (Priority Order)

### MUST FIX (Phase 4 blockers):
1. **Update `api-key-validator.test.ts` mocks** (3 tests)
   - Line 175-185: Change `key_id` → `id`, `owner_id` → `org_id`
   - Line 233-243: Add `is_active: 1` to expiredKey mock, ensure `expires_at < now`
   - Line 361-362: Ensure mock returns `id: '0123456789abcdef'` (not '1')

2. **Add tests for Phase 4 migrations**
   - Create `src/lib/db/__tests__/phase4-rate-limit-rpc.test.ts` (rate limit RPC calls)
   - Create `src/app/api/cron/__tests__/usage-export-integration.test.ts` (job insertion + dispatch)
   - Test `sql-rate-limiter.ts` with typed RPC response

### SHOULD FIX (Coverage improvements):
- Verify rate limit increment RPC with d1-query-builder integration
- Test export_jobs trigger behavior (batch insert → async processing)

### DEFER (Pre-existing):
- Better Auth import resolution (6 failures) — address in separate Phase

---

## Unresolved Questions

1. **Test data generation:** Should Phase 4 add shared test fixtures for D1 schema?
2. **Migration testing:** How to test D1 migrations without a live D1 instance?
3. **Cron export route:** What behavior should `usage-export/route.ts` verify? (Job creation? RPC execution?)

