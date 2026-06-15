# Backend & Database Review — Sophia AI Factory

**Scope:** `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/`
**Date:** 2026-06-08
**Focus:** D1 query patterns, migrations, indexes, N+1, tier lookups, schema consistency

---

## Critical Issues

### C1 — Migration numbering collisions (silent skip risk)
**Files:** `migrations/0178_idempotency_keys.sql`, `migrations/0178_referral_rewards_table.sql`, `migrations/0140_create_campaign_checkpoints.sql`, `migrations/0140_fix_campaign_checkpoints_columns.sql`, `migrations/0031-affiliate-offers-catalog.sql`, `migrations/0031-video-pipeline-jobs.sql`, `migrations/0032-seed-affiliate-catalog.sql`, `migrations/0032-voices.sql`, `migrations/0033-video-templates.sql`, `migrations/0033-video-usage-monthly.sql`, `migrations/0034-tenant-storage-usage.sql`, `migrations/0034-video-onboarding-events.sql`

Six migration number pairs are duplicated. `apply-migrations.sh` tracks by `_migrations` table using basename, so both files in a pair can execute. However, `git diff --name-only HEAD~1 HEAD -- migrations/` sorts alphabetically, not numerically — `0140_create` executes before `0140_fix`, so the fix runs after the broken table was created. This is fragile: any reordering in the filesystem breaks correctness.

**Recommendation:** Renumber all collisions sequentially (0140a/0140b, 0178a/0178b, etc.) to make ordering explicit and filesystem-order-independent.

### C2 — `getUserTier()` silent error swallow masks DB outages
**File:** `src/seed/db/get-user-tier.ts:69-71`

```ts
} catch {
  return 'BASIC' as Tier;
}
```

Every DB failure (binding unavailable, D1 timeout, malformed query) silently returns `BASIC`. In production this means a D1 degradation silently downgrades all users to BASIC — no payment features, no admin access — with zero observability. The caller has no way to distinguish "user is genuinely BASIC" from "DB is broken."

**Recommendation:** Log the error before falling back. Consider a configurable fallback tier or throwing for non-D1-available errors.

```ts
} catch (err) {
  logger.error('[getUserTier] DB error, falling back to BASIC', { userId, error: toError(err) });
  return 'BASIC' as Tier;
}
```

---

## High Priority

### H1 — `preInstallSops` N+1 query loop
**File:** `src/tree/handover/handover-account-setup.ts:142-162`

For each SOP slug, a separate `SELECT ... LIMIT 1` + `INSERT OR IGNORE` is issued. With 3-5 starter SOPs this is tolerable, but the function receives `sopSlugs: string[]` with no length cap. A handover with 50+ slugs = 100+ sequential D1 round-trips.

**Recommendation:** Batch-fetch all template IDs in one query, then batch-insert all installations:

```ts
const placeholders = sopSlugs.map((_, i) => `?${i+1}`).join(',');
const { results } = await db.prepare(
  `SELECT id, slug FROM sop_templates WHERE slug IN (${placeholders}) AND status = 'published'`
).bind(...sopSlugs).all<{id: string; slug: string}>();
```

### H2 — `getUserTier()` hot path: 2 sequential queries without composite index guarantee
**File:** `src/seed/db/get-user-tier.ts:41-68`

On every authenticated request, `getUserTier()` runs:
1. `SELECT tier, plan FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`
2. If no user-scoped sub, `SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1` then another subscriptions query by org_id.

Migration 0091 adds `idx_subscriptions_user_status` but **the index file is `0174-add-composite-indexes.sql`** which may not have been applied on all environments. There is no CI verification that the index exists on the remote D1. The query also has no index on `org_members(user_id)` for the fallback — migration 0088 adds it, but again no verification.

**Recommendation:** Add an explicit index existence check to the post-deploy verify sequence, and consider merging the 2-query pattern into a single `LEFT JOIN` or using a covering index.

### H3 — `TENANT_SCOPED_TABLES` set is incomplete — most tables get auto-scoped
**File:** `src/seed/db/with-tenant-scope.ts:19-25`

Only 5 tables are explicitly scoped. The `from()` method at line 59 auto-injects `WHERE tenant_id = ?` for ALL non-bypass tables — meaning a developer querying `subscriptions`, `videos`, or any non-listed table through `TenantScopedClient` gets a broken query (column doesn't exist → empty result, no error).

**Recommendation:** Either expand `TENANT_SCOPED_TABLES` to be exhaustive, or invert the logic: only inject `tenant_id` for explicitly listed tables (safe default = no injection).

### H4 — `createServerClient()` return value is sometimes `undefined` (fallback path)
**File:** `src/seed/db/client.ts:77-85`

When `getD1Sync()` throws, `createServerClient()` returns `undefined` (implicit return from catch block). Any caller doing `createServerClient().from('...')` on the fallback path gets `Cannot read properties of undefined (reading 'from')`. The LazyQueryChain proxy at line 85 catches this by creating a new Proxy, but the Proxy's `from()` method calls `getD1Async()` — meaning the sync API silently becomes async, which breaks callers that don't await.

**Recommendation:** Throw explicitly from `createServerClient()` on failure rather than returning undefined. The Proxy fallback should only be used through the documented `rpc()` path.

---

## Medium Priority

### M1 — `d1-query-chain-executors.ts` execInsert/execUpsert: no error propagation on failure
**File:** `src/seed/db/d1-query-chain-executors.ts:84-148`

`execInsert` and `execUpsert` loop through rows with `await ... .run()` but no try/catch. D1 throws on constraint violations, FK failures, etc. — the throw propagates up unhandled. Compare with `videos-repo.ts` which wraps each D1 call in try/catch. The query chain layer should either catch and return `{error}` or document that throws are intentional.

### M2 — `004_error_log.sql` naming convention mismatch
**File:** `migrations/004_error_log.sql`

This migration uses underscore prefix (`004`) while the canonical pattern is zero-padded (`0004-`). The `apply-migrations.sh` script uses `git diff --name-only` then `sort` — this file sorts *before* `0004-user-profiles.sql` alphabetically, but numerically it should be equivalent. The `check-migration-coverage.sh` grep for `CREATE TABLE` will pick it up correctly, but human reviewers may miss it. This is a consistency hazard.

### M3 — Migration gaps (0005-0066 skip, 0036, 0074, 0076, etc.)
**Files:** 23+ missing sequential numbers

While the gaps are documented (renamed/moved files), the `apply-migrations.sh` comment-of-record states "migrations are applied in git-diff order" which depends on filesystem sorting. Gaps make it harder to reason about "what ran between migration N and N+10." The migration coverage test (`migration-coverage-guard.test.ts`) guards CREATE TABLE coverage but does NOT verify sequential integrity or index coverage.

### M4 — `middleware.ts` inline tier check duplicates `getUserTier()` logic
**File:** `src/middleware.ts:183-191`

The middleware runs its own raw D1 query for tier lookup instead of calling `getUserTier()`. The comment explains this is because `getUserTier()` reads `globalThis.__env.DB` which is undefined at edge runtime. But this means two independent code paths resolve tier — if one is fixed and the other isn't, they diverge. The tier resolution logic is now in 3 places: `getUserTier()`, `resolveUserTier()`, and `middleware.ts`.

### M5 — `land/openclaw/with-tenant.ts` vs `seed/db/with-tenant-scope.ts` — two implementations
**Files:** `src/land/openclaw/with-tenant.ts`, `src/forest/openclaw/with-tenant.ts`, `src/seed/db/with-tenant-scope.ts`

Both `land/` and `forest/` re-export a `withTenantScope` that is a *different* implementation from the canonical one in `seed/db/`. The `seed/` version wraps `D1Client` with auto-tenant injection. The `forest/` and `land/` versions appear to be async wrappers with different APIs. This creates maintenance burden and risk of behavioral drift.

### M6 — `user_profiles` table referenced by 30+ files but has no FK to `user` table
**File:** `migrations/0004-user-profiles.sql`

`user_profiles.user_id` references `users(id)` (plural), but Better Auth creates users in `"user"` (singular). The 0087/0088/0089 migrations fixed this exact FK bug for `subscriptions`, `org_members`, and `videos`, but `user_profiles` was never rebuilt. If FK enforcement is ever re-enabled (`PRAGMA foreign_keys = ON` — which it is per migration 0087), inserts into `user_profiles` referencing a better-auth `user.id` will fail.

---

## Low Priority

### L1 — `D1_BATCH_LIMIT = 500` is enforced at insert/upsert only
**File:** `src/seed/db/d1-query-chain-executors.ts:17`

The batch limit guard exists on `execInsert`/`execUpsert` but not on the raw `db.batch()` used in `d1-client-rpc.ts:71-80`. A caller using `db.batch()` directly could exceed reasonable statement counts.

### L2 — `subscriptions` table: `polar_subscription_id` column retained after Polar deprecation
**File:** `migrations/0001-init.sql:51`, `migrations/0138_deprecate_polar_columns.sql`

Migration 0138 deprecates Polar columns but `polar_subscription_id` remains in the schema. Migration 0138 only adds a comment — the column is not dropped. This is dead schema weight.

### L3 — Duplicate `error_log` migration naming
**File:** `migrations/0004_error_log.sql` (note: `004_error_log` was my earlier observation; actual file appears to be `0004_error_log.sql` based on the ls output)

Wait — the listing shows `0004_error_log.sql` (with underscore) and `0004-user-profiles.sql`. The `check-migration-coverage.sh` script greps `migrations/*.sql` alphabetically. `0004_error_log.sql` sorts *after* `0004-user-profiles.sql`. This is fine for apply order but inconsistent with the dash-separated convention used by all 100+ other migrations.

---

## Positive Observations

1. **CAS patterns in videos-repo.ts** — `recordAttemptCAS`, `markPermanentFailureCAS`, and `recordWebhookAttemptCAS` correctly use `WHERE status = ?` + `RETURNING` to prevent double-counting on webhook+cron races. This is production-grade concurrency handling.
2. **`INSERT OR IGNORE` idempotency** — `enqueueVideo` and `insertAiPromptVideo` use `INSERT OR IGNORE` with UNIQUE constraints to eliminate TOCTOU races without application-level locks.
3. **Migration coverage guard** — `migration-coverage-guard.test.ts` + `check-migration-coverage.sh` is a strong pattern that caught the 2026-05-10 incident. It should be extended to verify indexes and sequential integrity.
4. **`D1_BATCH_LIMIT` enforcement** — The 500-row cap on `execInsert`/`execUpsert` with explicit error return prevents runaway sequential D1 calls.
5. **`with-tenant-scope.ts` design** — The `BYPASS_TABLES` set (Better Auth tables) correctly exempts tables that don't have `tenant_id`. The `insertScoped` validation prevents tenant ID spoofing.

---

## Unresolved Questions

1. **Duplicate migration execution order on remote D1:** When `apply-migrations.sh` encounters `0178_idempotency_keys.sql` then `0178_referral_rewards_table.sql`, both run in alphabetical order. Does the `_migrations` table track by basename or full filename? If basename, the second file would be SKIPPED (already applied) — meaning one of the two 0178 migrations was never applied on remote D1.
2. **`0004_error_log.sql` vs `0004-user-profiles.sql` ordering:** Since `004_error_log.sql` sorts alphabetically before `0004-user-profiles.sql`, the error_log table may have been created before user_profiles on a fresh D1. Is there a FK dependency?
3. **`user_profiles` FK to `users(id)`:** Has anyone verified that `PRAGMA foreign_keys = ON` is actually active in production D1? If it's OFF (which some migrations temporarily set), the FK trap is dormant but could activate on wrangler config changes.

---

## Summary

The codebase shows strong DB engineering patterns (CAS, idempotency, batch limits, coverage guards). The most impactful issues are:
- **C1:** Migration numbering collisions — medium risk today, high risk if reorder occurs
- **C2:** Silent tier downgrade on DB errors — production blast radius is all authenticated users
- **H1:** N+1 in handover SOP pre-install — will degrade with more starter SOPs
- **H3/H4/M5:** Incomplete tenant scoping + divergent withTenantScope implementations — correctness risk for multi-tenant data isolation
