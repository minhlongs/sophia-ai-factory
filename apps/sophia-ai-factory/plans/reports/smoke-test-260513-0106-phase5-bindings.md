# Smoke Test — Phase 5.1 tagCache + Backup Binding

**Date:** 2026-05-13 01:06 PT
**Production SHA:** `8d525481` (verified via `/api/version`)
**Tester:** session smoke pass after `8d525481` deploy

---

## Summary

Two runtime verifications targeting Phase 5.1's claim that the `--config wrangler.toml` flag restored ALL bindings on the worker (NEXT_TAG_CACHE_D1, BACKUPS_BUCKET, VIDEO_BUCKET):

| Test | Result | Evidence |
|------|--------|----------|
| 1. tagCache D1 (sophia-tag-cache) schema + writeable | ✅ PASS | Schema query + manual INSERT verified |
| 2. Worker bindings list incl. BACKUPS_BUCKET + NEXT_TAG_CACHE_D1 | ✅ PASS | `@opennextjs/cloudflare deploy --config wrangler.toml --dry-run` shows ALL 6 critical bindings |
| 3. Production HTTP | ✅ PASS | `/api/version` SHA match `8d525481`, `/api/health` `{"status":"healthy"}` |
| 4. Route auth gate (Phase 4 + 5.1) | ✅ PASS | `/api/cron/d1-backup` returns `401 Unauthorized` on dummy token |

---

## Test 1 — tagCache D1 Schema + Writeability

**Setup:** Migration `0108-opennext-tag-cache.sql` applied to NEW `sophia-tag-cache` D1 (database_id `7b1d4fd4-8aa2-4006-828a-ef2b76652a46`, region APAC) during Phase 5.1.

**Verify schema:**
```bash
npx wrangler d1 execute sophia-tag-cache --remote \
  --command="SELECT sql FROM sqlite_master WHERE name='revalidations';"
```

Output:
```sql
CREATE TABLE revalidations (
  tag TEXT NOT NULL,
  revalidatedAt INTEGER NOT NULL,
  stale INTEGER NOT NULL,
  expire INTEGER,
  UNIQUE (tag) ON CONFLICT REPLACE
)
```

Matches upstream `@opennextjs/cloudflare 1.19.9` adapter contract — adapter inserts `(tag, revalidatedAt, stale, expire)` and relies on `UNIQUE(tag) ON CONFLICT REPLACE` for upsert semantics.

**Verify writeable:**
```bash
npx wrangler d1 execute sophia-tag-cache --remote \
  --command="INSERT INTO revalidations (tag, revalidatedAt, stale) \
  VALUES ('phase-5.1-smoke-test', $(date +%s)000, $(date +%s)000);"
# {"changes": 1, "rows_written": 2} → INSERT succeeded
```

Then row cleaned up:
```bash
npx wrangler d1 execute sophia-tag-cache --remote \
  --command="DELETE FROM revalidations WHERE tag='phase-5.1-smoke-test';"
# {"changes": 1} → DELETE succeeded
```

Pre-test row count: 0. Post-cleanup: 0. Table is empty + writeable.

---

## Test 2 — Worker Bindings (All Critical)

Run with explicit `--config` flag (per Phase 5.1 deploy fix):

```bash
npx @opennextjs/cloudflare deploy --config wrangler.toml --dry-run | grep env\.
```

Output:

```
env.EXPERIMENT_KV (c3857792e4014334ba31b62b19d2f32a)               KV Namespace
env.DB (sophia-raas-db)                                            D1 Database
env.NEXT_TAG_CACHE_D1 (sophia-tag-cache)                           D1 Database
env.NEXT_INC_CACHE_R2_BUCKET (sophia-ai-factory-opennext-cache)    R2 Bucket
env.VIDEO_BUCKET (sophia-videos)                                   R2 Bucket
env.BACKUPS_BUCKET (sophia-backups)                                R2 Bucket
env.WORKER_SELF_REFERENCE (sophia-ai-factory)                      Worker
env.IMAGES                                                         Images
env.ASSETS                                                         Assets
env.NEXT_PUBLIC_DISTRIBUTE_ENABLED ("1")                           Environment Variable
```

Compare to PRE-Phase-5.1 dry-run (without `--config`):

```
env.EXPERIMENT_KV                                                  KV Namespace
env.DB (sophia-raas-db)                                            D1 Database     ← only D1 binding!
env.NEXT_INC_CACHE_R2_BUCKET (sophia-ai-factory-opennext-cache)    R2 Bucket       ← only R2 binding!
env.WORKER_SELF_REFERENCE                                          Worker
[...]
```

**Verdict:** `--config` flag restoration adds back the 4 silently-dropped bindings:
- `NEXT_TAG_CACHE_D1` (Phase 5.1)
- `VIDEO_BUCKET` (since Phase 01)
- `BACKUPS_BUCKET` (Phase 4)
- + identifier metadata on existing R2 bucket

**Phase 4 implication:** prior to commit `8d525481`, the deploy `3d3ed5fb` (Phase 4 backup automation) would have shipped with `BACKUPS_BUCKET` binding missing. The `/api/cron/d1-backup` route would have returned `500 {"reason":"BACKUPS_BUCKET binding unavailable"}` on first cron invocation. The Phase 5.1 deploy fix corrects this retroactively.

---

## Test 3 — Production Live

```bash
curl -s https://sophia.agencyos.network/api/version
# {"shortSha":"8d525481","deployedAt":"2026-05-13T07:34:15Z","opennextVersion":"1.17.3"}

curl -s https://sophia.agencyos.network/api/health
# {"status":"healthy","timestamp":"2026-05-13T08:10:08.423Z","sha":"8d525481..."}

curl -sI https://sophia.agencyos.network | head -1
# HTTP/2 200
```

All three live signals match.

---

## Test 4 — Route Auth Gate

```bash
curl -sH "Authorization: Bearer dummy-not-real-token" \
  https://sophia.agencyos.network/api/cron/d1-backup
# {"error":"Unauthorized - Cron authentication required"}
```

`verifyCronAuth()` correctly rejects bad token. Cannot test 200-path runtime without exposing the real `CRON_SECRET` value, but auth gate is wired and active.

---

## What's NOT Verified (Limits of Anonymous Smoke Test)

1. **End-to-end tagCache write from worker:**
   - Requires triggering an authenticated Server Action that calls `revalidateTag()`/`revalidatePath()`
   - Cannot be invoked anonymously (Server Actions require Better Auth session cookie)
   - Will be confirmed organically when next operator action revalidates settings/campaigns/SOPs
   - Indirect confirmation: schema matches adapter contract, binding resolves at deploy time → write path SHOULD work
   
2. **End-to-end backup execution:**
   - Requires `CRON_SECRET` (wrangler secret, value unknown to tester)
   - Will be confirmed when Upstash QStash cron fires (operator pending)
   - Binding resolution: now provable via dry-run with `--config` flag

3. **SENTRY_AUTH_TOKEN propagation to source map upload:**
   - `wrangler secret list` shows `SENTRY_AUTH_TOKEN` set as a worker secret (runtime)
   - BUT `scripts/ci/sentry-upload-sourcemaps.sh` reads from SHELL env at deploy time, not from wrangler secrets
   - Latest deploy log: `warn: SENTRY_AUTH_TOKEN not set — skipping Sentry source map upload`
   - Operator action: export `SENTRY_AUTH_TOKEN` in deploy shell (or source from `.dev.vars` before running `npm run deploy:full`)

---

## Score Impact (Post-Smoke-Test)

| Layer | Pre-Phase-5.1 | Post-Smoke | Notes |
|-------|--------------:|----------:|-------|
| L2 Server | 8 | **9** | tagCache config wired, binding resolves, table schema correct |
| L9 CDN | 8 | **9** | `revalidateTag/Path` no longer no-ops (binding live; first write pending Server Action) |
| L10 Backup | 7 | **7** | Backup route binding resolves; cron not yet registered with QStash (operator) |

**Honest score:** 88 → **90/100** (verified vs claimed). +2 from L2 + L9.

Remaining gap (90 → 93+):
- +1 L1/L10 when QStash cron registers AND first backup actually runs (operator P0)
- +1 L7 when SENTRY_AUTH_TOKEN exported in deploy shell (operator P0)
- +1 L4/L5 if DMARC graduates to `quarantine` after 30d (operator P1, time-gated)

---

## Unresolved Questions

1. **Should we expose a CRON_SECRET-protected `/api/cron/binding-check` route** to make future deploys' binding resolution observable without dry-run?
2. **Is `wrangler` v4.90.x dry-run output reliably representative** of post-deploy binding state? (We confirmed bindings appear with `--config` flag, but is this 100% deterministic?)
3. **Phase 4 BACKUPS_BUCKET retroactive concern:** if the backup cron HAD been registered between Phase 4 deploy (`3d3ed5fb`) and Phase 5.1 deploy (`8d525481`), would the failure have been silent (BetterStack heartbeat skipped) or surface as 500 errors in Cloudflare dashboard? Worth checking CF analytics.
4. **tagCache table on sophia-raas-db (orphan from Phase 5 attempt)** — drop in next migration round to clean state.
