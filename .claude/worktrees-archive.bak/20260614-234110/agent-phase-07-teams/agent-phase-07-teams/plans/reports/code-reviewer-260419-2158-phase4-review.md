# Phase 4 D1 Migration — Code Review

**Date:** 2026-04-19 21:58
**Reviewer:** code-reviewer agent
**Scope:** 6 files (2 SQL migrations + 4 TS files)
**Verdict:** **BLOCK** — deploy-before-migrate will break prod; schema mismatch in export_jobs.

---

## Scores (/10)

| Area | Score | Notes |
|---|---|---|
| SQL correctness (0013, 0014) | 6 | Idempotent OK, but 0014 schema diverges from code |
| RPC atomic upsert | 7 | Works, but has a subtle CAST bug + race window |
| Schema migration (api-key-validator) | 6 | Compiles, but org_id FK + is_active semantics risky |
| Callers backward-compat | 7 | Aliases work, but 2 call sites need audit |
| Runtime safety (deploy order) | 3 | Prod will 500 until migration applied |
| **Overall** | **5.8/10** | **REVISE before merge; BLOCK on deploy** |

---

## CRITICAL Issues

### C1. export_jobs schema mismatch (DEFINITIVE BUG)
`migrations/0014-export-jobs.sql` defines columns `org_id, job_type, status, window_start, window_end, row_count, file_url, started_at, completed_at`. But `src/app/api/cron/usage-export/route.ts` INSERTs `license_nonce, record_count, export_format, period_start, period_end, success, error_message` — **none of these columns exist in 0014**. Every nightly cron run will fail with `no such column: license_nonce`. The `ExportJobInsert` interface is TS theater — it doesn't validate against the actual DB. **Fix:** Either rewrite 0014 to match the code shape, or rewrite the cron inserter to match 0014 (row_count/status/window_start etc).

### C2. raas_licenses table doesn't exist in D1
`getActiveLicenses()` queries `db.from('raas_licenses')` but no migration defines this table. First cron execution → 500. Phase 4 is incomplete: add `0015-raas-licenses.sql` or stop querying it.

### C3. Deploy-before-migrate = prod outage
If Phase 4 code lands before `0013`/`0014` apply on prod D1, every rate-limited endpoint (api/auth/admin/webhook) throws "no such table: rate_limits" and fails closed (returns `MAX_SAFE_INTEGER > maxRequests` → all requests 429). Order MUST be: migrate D1 → then deploy. Add a CI gate or feature-flag fallback.

### C4. raas_api_keys.org_id FK violation risk
`0001-init.sql` defines `org_id TEXT NOT NULL REFERENCES organizations(id)`. `generateApiKey()` writes `org_id: userId`. If Better Auth userId is NOT also a row in `organizations(id)`, INSERT fails with FK constraint error. Verify Better Auth creates a 1:1 org per user (comment in file claims so; needs test).

---

## HIGH Priority

### H1. RPC `strftime('%s', window_start) < ?3` comparison bug
`window_start` is stored as `TEXT DEFAULT (datetime('now'))` → ISO-like `'2026-04-19 21:58:00'`. `strftime('%s', ...)` returns a **string**. `?3` is bound as a JS number (unix seconds). SQLite will do string-vs-numeric comparison with type affinity; usually works but is fragile across SQLite versions and on edge. **Fix:** `CAST(strftime('%s', window_start) AS INTEGER) < ?3`.

### H2. Rate limiter race window
`INSERT ... ON CONFLICT DO UPDATE` is atomic per-row in SQLite, so concurrent requests serialize via row lock. Safe. BUT D1 has eventual consistency across replicas — two edge workers hitting different replicas within the same window can each see `current_count=0` and both start at 1. Not a blocker at current scale, but document as known limit.

### H3. is_active=0 loses revoke audit trail
Migration-comment admits `revoked_at → is_active=0` but there's no `revoked_at` column added to raas_api_keys. You can no longer answer "when was key X revoked?". For SOC2/audit, add `revoked_at TEXT` and set it alongside `is_active=0`.

### H4. `getUserApiKeys` filters by `org_id = userId` — semantic leak
If user belongs to a multi-user org, this returns ALL keys of that org, not "the user's keys". Current single-user-org assumption makes it OK; flag for later when teams land.

---

## MEDIUM

- **M1.** `rate_limits` has no TTL/cleanup trigger; `cleanupExpiredRateLimits` exists but isn't scheduled in the exported code. Confirm cron wires it.
- **M2.** `export_jobs.id DEFAULT (lower(hex(randomblob(16))))` is fine, but cron passes explicit `crypto.randomUUID()` — inconsistent ID format (16-hex vs UUID-with-dashes). Pick one.
- **M3.** `permissions` column in raas_api_keys is TEXT with JSON. `parseJsonFields` helper auto-parses strings starting with `[`. OK, but `ApiKeyRow.permissions: string[] | string` forces every reader to branch. Tighten to `string[]` after parse.
- **M4.** `sql-rate-limiter.ts` still imports `telegram_rate_limits` in cleanup — verify that table exists or remove.

---

## LOW / Nits

- L1. `d1-query-builder.ts` has grown past 540 LOC; file-size rule says <200. Split RPC handlers into `d1-rpc-handlers.ts`.
- L2. `export_jobs.status` lacks `CHECK IN ('pending','running','success','failed')` constraint. Enum drift risk.
- L3. `0013` has no index on `identifier` (it's PK, so implicit B-tree — fine, just note).

---

## Edge Cases (scouted)

- Clock skew between worker and D1 host → `strftime('%s','now')` vs JS `Date.now()/1000` can differ by ±1s at window boundary → off-by-one rate-limit resets. Negligible.
- `fullIdentifier = 'api:user:123'` — colons in identifier: no problem since PK is opaque TEXT.
- `rate_limit_per_minute = 0` would never allow any request; no guard in `checkApiKey`.

---

## Positive

- RPC shim pattern keeps Supabase→D1 migration low-diff. Good.
- Typed `RateLimitRpcRow` + removed `any` — clean.
- Backward-compat aliases on `ApiKeyInfo` (keyId/ownerId) are a low-risk bridge. Good migration ergonomics.

---

## Recommended Actions (ordered)

1. **BLOCK deploy** until C1/C2 resolved (schema mismatch + missing raas_licenses).
2. Fix `0014` to match cron code OR rewrite cron to match `0014`. Write a test that inserts into export_jobs and reads back — would have caught C1 immediately.
3. Add migration 0015 for `raas_licenses` (or remove cron if dead code).
4. Add `revoked_at TEXT` column to raas_api_keys via a 0016 migration; update revoke() to set both.
5. Patch RPC with `CAST(... AS INTEGER)` (H1).
6. Add CI guard: refuse deploy if pending migrations exist on prod D1.
7. Apply 0013/0014 to prod D1 BEFORE code merge lands on main.

---

## Unresolved Questions

- Is `raas_licenses` a Supabase-only table that was never migrated, or new work pending?
- Does Better Auth auto-create an `organizations` row per user on signup? (If not, C4 bites on first key creation.)
- Scheduled cron for `cleanupExpiredRateLimits` — is it wired in wrangler.toml?
- Are there existing export_jobs rows on Supabase to migrate, or is this a fresh D1 table?
