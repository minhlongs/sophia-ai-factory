# Phase 3 — AXIS 1: RELIABILITY Audit

**Date:** 2026-05-22
**Prod SHA:** d86659bf
**Auditor:** debugger agent
**Scope:** 6 reliability sub-areas

---

## SUB-AREA 1: Cron Health — 18 scheduled vs 30 handlers

### Findings

**wrangler.toml `crons` array:** 18 patterns
**`src/app/api/cron/` directories:** 30 handler directories
**`scripts/inject-scheduled-handler.mjs` CRON_ROUTES:** 15 distinct cron expressions → 18 dispatched routes

The 12 unmapped (no CRON_ROUTES entry) split into two groups:

**Group A — 5 patterns ARE in wrangler.toml crons array but NOT in CRON_ROUTES (fire + no-op):**

| Pattern | Handler | Status |
|---------|---------|--------|
| `0 5 * * *` | `error-digest` | P2 stub — fires every day at 05:00 UTC, dispatch skipped (no routes → `[scheduled] No handler for cron pattern` log) |
| `*/10 * * * *` | `heartbeat` | P2 stub — fires every 10 min (same) |
| `0 7 * * *` | `llm-cache-purge` | Mentioned in wrangler comments but omitted from CRON_ROUTES |
| `10 * * * *` | `wallet-rebuild` | M5 — in wrangler comments only |
| `0 */4 * * *` | `affiliate-scout` | In wrangler comments only |

**Group B — 8 handler directories exist but have no wrangler schedule (truly manual-only):**

| Handler | Accessible via |
|---------|---------------|
| `ab-winner-picker` | HTTP GET with CRON_SECRET only |
| `d1-backup` | HTTP GET with CRON_SECRET only (no external scheduler provisioned) |
| `daily-rollup` | Manual only |
| `hourly-rollup` | Manual only |
| `local-mode-health` | Manual only |
| `quota-check` | Manual only |
| `status-rollup` | Manual only |
| `workflow-stepper` | Manual only (wrangler.toml comments explicitly say `*/1 * * * *` was removed — "burning invocations") |

**Risk assessment:**
- Group A `0 5 * * *` and `*/10 * * * *` fire at high frequency on live platform, produce `[scheduled] No handler` logs, and consume Cloudflare cron invocation budget with no business value. Low but measurable cost.
- `d1-backup` is Group B: no automatic trigger. **Backups have NEVER run** (D1 `cron_run_log` confirms `cnt=0` for `d1-backup`). R2 `sophia-backups` bucket lifecycle is configured but bucket may be empty.
- `llm-cache-purge` (`0 7 * * *`) and `wallet-rebuild` (`10 * * * *`) are in the crons array but missing from CRON_ROUTES — these accumulate dead invocations + no functional work performed.

**Evidence:** `wrangler.toml:64`, `scripts/inject-scheduled-handler.mjs:40-82`, `cron_run_log` remote query → `d1-backup cnt=0`

### Score: **6/10**

Gap: 5 patterns fire with no handler wired; d1-backup has no trigger; 2 functional handlers (llm-cache-purge, wallet-rebuild) have patterns registered but silently skip.

---

## SUB-AREA 2: D1 Backup + Restore

### Findings

**Backup infrastructure:** Route `GET /api/cron/d1-backup` exists (`src/app/api/cron/d1-backup/route.ts`). Uses `buildD1Dump()` → uploads to R2 `sophia-backups` as `d1-YYYY-MM-DD.sql`. 50 MiB ceiling enforced. Idempotency window 12h. Heartbeat on success.

**R2 lifecycle:** `delete-after-30d` rule confirmed live:
```
name: delete-after-30d
enabled: Yes
prefix: (all prefixes)
action: Expire objects after 30 days
```
Source: `wrangler r2 bucket lifecycle list sophia-backups`

**Trigger status:** wrangler.toml comments say "triggered by external cron (Upstash QStash)". No-tech doctrine (`sophia-no-tech-doctrine.md`) says external cron registration is out of scope — operator does not register QStash. The wrangler `crons` array does NOT include a pattern for `d1-backup`. The route exists but has no automatic trigger, internal or external.

**Backup execution history:**
```sql
SELECT COUNT(*) FROM cron_run_log WHERE cron_name='d1-backup'; → 0
```
**Zero backups have ever run in production.**

**Restore drill:** Runbook `docs/runbooks/backup-restore-drill.md` (RUN-BACKUP-001) is written, detailed, and correct. Restore procedure is documented. `CLIENT-HANDOVER-PACKAGE.md:214` says "DR drill: Phase 07 pending" and "Measured RTO/RPO: TBD after Phase 07 DR drill executes".

**RPO/RTO defined:** RPO=24h, RTO=4h (`docs/deployment-guide.md:300`, `docs/runbooks/d1-region-failure.md:5`).

**Evidence:** `d1-backup/route.ts:1-140`, `wrangler.toml:23-28`, lifecycle list output, `cron_run_log` count=0, `docs/runbooks/backup-restore-drill.md`, `docs/CLIENT-HANDOVER-PACKAGE.md:95`

### Score: **4/10**

Route exists + lifecycle configured + RPO/RTO defined + drill SOP written = significant investment. But **zero backups have ever run** = the claimed RPO=24h is currently **unachieved**. Backup capability = 0% until trigger is wired.

---

## SUB-AREA 3: Migration Drift

### Findings

**Local migration files:** 120 (numbered `0001` through `0117` + several unnumbered/variant files like `0004_error_log.sql`)
**Phase 1 researcher-02 claim:** 117 applied to remote
**Phase 1 researcher-04 claim:** 120 local

**Root cause of discrepancy:** `apply-migrations.sh` uses `git diff --name-only --relative HEAD~1 HEAD -- migrations/` to find new migration files and applies them via `wrangler d1 execute --file`. This mechanism **bypasses the `d1_migrations` tracking table entirely**.

**D1 remote tracking state:**
```sql
SELECT COUNT(*) FROM d1_migrations; → 4 records
-- Records: 0001-init.sql (2026-04-17), 0006-schema-alignment.sql (2026-03-24),
--          0005-mission-steps.sql (2026-03-24), 0030-videos-r2-key.sql (2026-04-29)
```

**Tables actually in production D1:** 123 user tables (confirmed via `sqlite_master`). Tables including `ab_experiments`, `help_videos`, `video_jobs_completed_at` (added by 0111, 0112, 0113) exist, proving migrations through at least 0113 have been applied.

**Impact:** `wrangler d1 migrations list --remote` reports ALL 120 as "to be applied" — this is a false positive. The command is unreliable as a drift detector for this project because the apply path bypasses wrangler's internal tracking. Any accidental re-run of `wrangler d1 migrations apply` would attempt to re-apply all 120 migrations (creating duplicate tables/indexes, likely erroring).

**Drift between "117 applied" and "120 local":** 3 files are likely post-Phase-1 additions (`0115-seed-video-generation-starter-sop.sql`, `0116-fix-user-sop-installations-template-fk.sql`, `0117-refresh-video-generation-starter-sop.sql`). These reference `user_sop_installations` table — need verification they are applied but no direct evidence from cron_run_log. The git log shows these are in `d86659bf`'s ancestry, and `deploy:all` includes `deploy:migrations`, so if operator ran `deploy:all` they would have been applied.

**Evidence:** `scripts/apply-migrations.sh:1-40`, D1 query results, `sqlite_master` table count=123, `package.json:deploy:all`

### Score: **5/10**

Tables exist = migrations functionally applied. But `d1_migrations` tracking table is inconsistent (4/120 tracked), making wrangler's migration state command misleading. Risk of accidental double-apply exists. No automated reconciliation between apply history and tracking table.

---

## SUB-AREA 4: Webhook Resilience

### Findings

**NOWPayments IPN idempotency:**
- `processNowPaymentsIpn()` calls `isPaymentProcessed(payment_id)` first (line 35, `nowpayments-ipn-handlers.ts`)
- Uses `payment_events` table with `event_id = "nowpayments_${payment_id}"` as unique key
- `recordIpnEvent()` uses `.upsert()` — safe for duplicate IPN delivery
- Auth: HMAC-SHA512 signature via `x-nowpayments-sig` header verified before processing
- **Verdict: idempotency is correctly implemented**

**HeyGen B2 fix verified in prod:**
- Commit `d68b4d96` (fix B2: heygen webhook user-scoping) is an ancestor of prod SHA `d86659bf` — confirmed via `git merge-base --is-ancestor`
- Fix adds `.eq('user_id', ownerUserId)` to D1 queries and early return when `!ownerUserId` to prevent cross-tenant video row mutation
- **Verdict: B2 fix is live in production**

**Webhook retry infrastructure:**
- `src/lib/webhooks/retry.ts` implements exponential backoff: 30s → 2m → 10m → 1h → 6h (5 attempts max)
- Dead-letter after attempt 5 (`isDeadLetter()`)
- `webhook_attempts` table exists in D1 (confirmed via `sqlite_master`)

**Failure replay procedure:**
- `docs/INCIDENT_RESPONSE.md:203-231` documents manual IPN replay via curl + HMAC signature construction
- Procedure is detailed and correct (HMAC-SHA256 signature, exact curl command, idempotency note)
- Admin endpoint `/api/admin/resend-activation-email` exists for email-only replay

**Gap:** IPN replay procedure uses HMAC-SHA256 in the docs but `verifyIpnSignature` at `src/tree/clients/nowpayments-client.ts` uses HMAC-SHA512. Minor documentation/algorithm mismatch — needs verification.

**Evidence:** `nowpayments-ipn-db.ts:21-44`, `nowpayments-webhook/route.ts:1-80`, `retry.ts:1-45`, `INCIDENT_RESPONSE.md:203-231`, git merge-base confirmation

### Score: **8/10**

Strong: idempotency + retry + replay SOP + B2 fix live. Gap: HMAC algorithm mismatch in replay docs (SHA256 vs SHA512) may cause operator failure during incident.

---

## SUB-AREA 5: Edge D1 Unavailability Handling

### Findings

**Middleware catch behavior:**
```typescript
// src/middleware.ts:178-179
} catch {
  return NextResponse.redirect(new URL('/login', request.url))
}
```
Top-level catch for the entire middleware redirects all unhandled errors (including D1 unavailability) to `/login`.

**Specific D1 error paths:**
- MFA check (line 135): `catch (mfaErr)` → **allow through** (non-fatal, logged)
- Admin tier check (line 166): `catch (tierErr)` → redirect to `/dashboard?error=admin_required`
- Top-level (line 178): redirect to `/login`

**D1 client fail behavior:**
`createServerClient()` at `seed/db/client.ts:56-75` wraps in a Proxy when `getD1Sync()` throws — the Proxy defers all operations to async `getD1Async()`. If D1 is completely unavailable, all queries fail at query time, not at client creation. Individual route handlers have their own try/catch patterns.

**Runbook `docs/runbooks/d1-region-failure.md`** documents:
- RTO 4h for full D1 outage
- Detection via `curl -sI /api/health` + `wrangler d1 execute --remote "SELECT 1"`
- Symptom table distinguishing D1 outage from code bugs

**Page-redirect fallback fragility under load:**
The middleware redirects authenticated users with session cookies to `/login` if any DB-touching check fails. Under D1 outage:
1. Session cookie is valid (Better Auth sessions are in D1)
2. Auth check fails → redirect to `/login`
3. Login page tries to resolve session → also fails → render degraded
4. This creates a feedback loop: all authenticated users get bounced to login, and login itself may be degraded

No static fallback page (no edge-cached "maintenance mode") is configured. Under load, repeated redirects amplify D1 query load.

**Evidence:** `middleware.ts:124-179`, `seed/db/client.ts:14-75`, `docs/runbooks/d1-region-failure.md:1-50`

### Score: **6/10**

Behavior is predictable (redirect to login, not 500) but the loop under D1 outage creates a degraded user experience with no graceful degradation path. No static maintenance page. Runbook exists but no automated detection/alert for this pattern.

---

## SUB-AREA 6: DR Posture (RPO/RTO + Restore Drill)

### Findings

**RPO/RTO defined:** Yes
- RPO = 24 hours (`docs/deployment-guide.md:300`, `docs/system-architecture.md:714`)
- RTO = 4 hours (`docs/runbooks/d1-region-failure.md:5`)
- Doctrine decision documented and dated 2026-05-20, quarterly review scheduled

**Restore drill procedure:** `docs/runbooks/backup-restore-drill.md` (RUN-BACKUP-001) is thorough — creates ephemeral D1, applies dump, verifies row counts on 3 critical tables. Quarterly cadence stated.

**Drill execution history:** `docs/CLIENT-HANDOVER-PACKAGE.md:95` states "Measured RTO/RPO: TBD after Phase 07 DR drill executes." No drill has been executed.

**Critical gap: DR posture is entirely theoretical** because:
1. `d1-backup` has **never run** (cron_run_log count=0)
2. R2 `sophia-backups` bucket may be empty (no CLI list available; no backup run recorded)
3. The drill SOP assumes `sophia-backups` has an object to restore from — if bucket is empty, drill cannot proceed
4. RPO=24h is documented but not achieved

**Rollback procedure:** `docs/INCIDENT_RESPONSE.md` has a solid rollback SOP using `wrangler rollback` (Cloudflare Worker-level rollback, not D1 data rollback). This is distinct from DR and works independently of backups.

**What works:**
- Worker-level rollback (code revert): fully operational, documented, tested via 5 manual deploys
- D1 schema rollback: not possible (no down-migration scripts)
- D1 data recovery: 0% operational until backup trigger is provisioned

**Evidence:** `deployment-guide.md:292-310`, `d1-region-failure.md:1-20`, `backup-restore-drill.md:1-40`, `CLIENT-HANDOVER-PACKAGE.md:95,214`, `cron_run_log` count=0

### Score: **4/10**

RPO/RTO defined + rollback SOP solid + drill procedure written. But zero backups exist = DR posture is paper-only. Worker-level rollback is real but covers code only, not data loss scenarios.

---

## Total Reliability Score

| Sub-Area | Score /10 |
|----------|-----------|
| 1. Cron Health | 6 |
| 2. D1 Backup + Restore | 4 |
| 3. Migration Drift | 5 |
| 4. Webhook Resilience | 8 |
| 5. Edge D1 Unavailability | 6 |
| 6. DR Posture | 4 |
| **TOTAL** | **33/60** |

---

## Top 3 Critical Gaps

### GAP-R1 (P0): D1 backup has NEVER run — RPO=24h is unachieved

**Evidence:** `cron_run_log WHERE cron_name='d1-backup' → cnt=0`

**Root cause:** No-tech doctrine removed external cron (QStash) requirement, but left the route with no alternative trigger. The wrangler `crons` array does not include a pattern for `d1-backup`. Route is reachable via `GET /api/cron/d1-backup` with `CRON_SECRET` but is never called.

**Fix:** Add `d1-backup` to wrangler.toml `crons` array and `CRON_ROUTES` in inject-scheduled-handler.mjs. Use daily schedule `0 3 * * *` (or similar). This stays within CF Workers native cron — no QStash needed, no external operator credential.

```
# wrangler.toml crons array: add "0 3 * * *" 
# inject-scheduled-handler.mjs CRON_ROUTES: add '0 3 * * *': ['/api/cron/d1-backup']
```

Alternatively wire to an existing daily slot (e.g., `0 5 * * *` currently fires with no handler).

**After fix:** run `GET /api/cron/d1-backup` manually once to seed the first backup; verify via `wrangler r2 object get sophia-backups/d1-<date>.sql`.

---

### GAP-R2 (P1): Migration tracking table inconsistent — 4/120 records tracked, wrangler reports all 120 as pending

**Evidence:** `d1_migrations COUNT → 4`, `wrangler d1 migrations list → 120 "to be applied"`, `sqlite_master → 123 tables`

**Root cause:** `apply-migrations.sh` uses `wrangler d1 execute --file` which bypasses the `d1_migrations` table. Only 4 migrations ran through `wrangler d1 migrations apply` (the wrangler-native path). An accidental `wrangler d1 migrations apply sophia-raas-db --remote` would attempt to re-create 120 tables, causing `table already exists` errors and potentially corrupting indexes.

**Fix:** Two options:
1. (Preferred) Populate `d1_migrations` retroactively: insert records for all 116 bypassed migrations with a migration run. See `docs/runbooks/d1-migration-hygiene.md` if exists.
2. (Acceptable) Add a migration hygiene check to CI/deploy: `scripts/check-migration-coverage.sh` already guards against orphan tables — extend it to also detect/warn on d1_migrations vs file count mismatch.
3. Add a guard in `deploy-with-sha.sh` that checks `d1_migrations` count vs local file count and warns if diverged.

---

### GAP-R3 (P2): 5 cron patterns fire as no-ops + HMAC algorithm mismatch in IPN replay docs

**5 dead cron invocations (Group A):**
- `0 5 * * *` (error-digest), `*/10 * * * *` (heartbeat), `0 7 * * *` (llm-cache-purge), `10 * * * *` (wallet-rebuild), `0 */4 * * *` (affiliate-scout) all fire with no CRON_ROUTES entry.
- On each invocation: `[scheduled] No handler for cron pattern` is logged and exits. Low cost but noisy logs + wasted invocations for llm-cache-purge and wallet-rebuild which have working route handlers.

**Fix:** Wire `llm-cache-purge` (`0 7 * * *`) and `wallet-rebuild` (`10 * * * *`) into CRON_ROUTES immediately — handlers exist and are functional. Remove `*/10 * * * *` (heartbeat) and `0 5 * * *` (error-digest) from `crons` array if P2 features are not yet ready, or add stub routes.

**HMAC mismatch:** `INCIDENT_RESPONSE.md:208` says `openssl dgst -sha256` but `verifyIpnSignature` likely uses SHA-512 (NOWPayments IPN spec uses HMAC-SHA512). Manual replay during incident will produce invalid signatures.

**Fix:** Verify `src/tree/clients/nowpayments-client.ts` algorithm, update `INCIDENT_RESPONSE.md:208` to match.

---

## Unresolved Questions

1. **R2 sophia-backups bucket content:** `wrangler r2 object list` subcommand not available in wrangler 4.93.0 CLI. Cannot confirm whether bucket is empty. Operator should run: `npx wrangler r2 bucket info sophia-backups` or check via Cloudflare dashboard.

2. **0115–0117 migrations applied?** These 3 migrations exist locally and in prod SHA ancestry. Tables `user_sop_installations` template FK constraint was updated. No direct confirmation from cron_run_log that these were applied (apply-migrations.sh is git-diff-based, not log-based). Operator should run: `npx wrangler d1 execute sophia-raas-db --remote --command "SELECT COUNT(*) FROM user_sop_installations;"` to confirm table exists.

3. **NOWPayments IPN HMAC algorithm:** `src/tree/clients/nowpayments-client.ts` not read in this audit — need to verify SHA-256 vs SHA-512 to confirm/deny GAP-R3 HMAC mismatch.

4. **Fulfill-retry "dead since 2026-05-02":** wrangler.toml comment says `fulfillment-retry` is "dead since 2026-05-02 commit a4d54d8d" yet it's still in CRON_ROUTES and `cron_run_log` shows `run_count: 9803`. Either the comment is stale or the handler silently no-ops. Should be audited under AXIS 2 or AXIS 5.
