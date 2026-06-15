# Phase 4B Report — Security Rewrites (D1 Canonical Schema)

## Status: COMPLETED

## Files Modified

### 1. `src/lib/security/api-key-validator.ts`
- Added `ApiKeyRow` interface with D1 canonical columns (`id`, `org_id`, `is_active`, `rate_limit_per_minute`, `key_prefix`)
- Updated `ApiKeyInfo` interface: added `id`, `orgId`, `isActive`; kept `keyId` + `ownerId` as backward-compat aliases
- `generateApiKey()`: INSERT now uses `id=keyId`, `org_id=userId`, `is_active=1`, `rate_limit_per_minute`, `key_prefix` — comment explains user→org_id mapping
- `checkApiKey()`: `.eq('id', keyId)` (was `key_id`); checks `data.is_active !== 1` (was `data.revoked_at`)
- `revokeApiKey()`: UPDATE `is_active=0, expires_at=now` (was `revoked_at=now`); `.eq('id', keyId)`
- `getUserApiKeys()`: `.eq('org_id', userId)` (was `owner_id`); `.from<ApiKeyRow>()` typed
- `deleteApiKey()`: `.eq('id', keyId)`
- Removed all `(db as any)` casts — uses typed `db.from<ApiKeyRow>()`

### 2. `src/lib/security/sql-rate-limiter.ts`
- Added `RateLimitRpcRow` interface `{ current_count: number }`
- Removed `eslint-disable @typescript-eslint/no-explicit-any` + `(db as any).rpc()`
- Now calls `db.rpc(...)` directly (D1Client has `increment_rate_limit` case)
- Typed RPC return as `{ data: RateLimitRpcRow[] | null; error: unknown }`
- Fixed `logger.error` to properly convert `unknown` → `Error`

### 3. `src/app/api/cron/usage-export/route.ts`
- Added `ExportJobInsert` interface for typed `export_jobs` insert
- Removed `(db as unknown as { from: (t: string) => any })` cast + `eslint-disable` comment
- Now uses `db.from<ExportJobInsert>('export_jobs').insert(...)` — proper typed D1 call

## ESLint Result
- 0 errors across all 3 files
- 2 pre-existing warnings (unused `exportToCSV`/`exportToJSON` imports in route.ts)

## TypeScript Result
- `api-key-validator.ts`: 0 errors
- `sql-rate-limiter.ts`: 0 errors
- `usage-export/route.ts`: 3 pre-existing errors at lines 112/117/129 (`getActiveLicenses` function — `QueryError`→`Error`, filter type mismatch, return type mismatch). NOT introduced by this phase.

## Backward Compatibility
- All 4 callers (violations, audit, admin/api-keys, usage/export) still compile — `keyId` and `ownerId` preserved as aliases on `ApiKeyInfo`
- Function signatures unchanged
- HTTP contracts unchanged

## Pre-existing Errors NOT Fixed (out of scope)
- `usage-export/route.ts:112` — `QueryError` not assignable to `Error` in `logger.error`
- `usage-export/route.ts:117` — filter generic type mismatch on `RaasLicenseRow[]`
- `usage-export/route.ts:129` — return type `Record<string,unknown>[]` vs `RaasLicenseRow[]`
These are in `getActiveLicenses()` which was not touched and pre-date this phase.
