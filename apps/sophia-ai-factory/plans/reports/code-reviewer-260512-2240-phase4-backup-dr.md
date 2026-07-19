# Code Review — Phase 4 Backup/DR (D1 → R2 daily)

**Reviewer:** code-reviewer
**Date:** 2026-05-12 22:40
**Plan:** `plans/260512-2105-fullstack-100of100-roadmap/phase-04-backup-dr.md`
**Scope:** 4 new files, 2 modified files, 1 archived workflow, R2 lifecycle infra change.

---

## Verdict: **APPROVE_WITH_FIXES**

**Score: 8.4 / 10**

- ✅ ≥ 8.0
- ✅ 0 CRITICAL
- 2 HIGH issues (recommended before next drill; non-blocking for ship)
- 4 MEDIUM issues
- 2 LOW

Ship is permitted. HIGH-1 and HIGH-2 must be addressed before the first quarterly DR drill (target: 2026-05) or you will discover them under duress.

---

## Scope Audit

| File | LOC | Status |
|---|---:|---|
| `src/forest/dr/d1-dump-builder.ts` | 120 | NEW — clean, well-commented, under 200-line guideline |
| `src/forest/dr/d1-dump-builder.test.ts` | 116 | NEW — 7 cases, all pass |
| `src/app/api/cron/d1-backup/route.ts` | 124 | NEW — under 200, follows route conventions |
| `scripts/dr/configure-upstash-qstash.sh` | 42 | NEW — set -euo pipefail, idempotent failure messaging |
| `wrangler.toml` | +4 lines | MOD — `[[r2_buckets]]` binding `BACKUPS_BUCKET` → `sophia-backups` |
| `docs/dev-sops.md` | +113 lines | MOD — SOP 14 + SOP 15 |
| `.github/workflows/d1-backup.yml` | — | ARCHIVED → `.disabled` |

Bundle impact on `.open-next/worker.js`: negligible. Entry is 5,126 bytes; new route bundles into a lazy chunk only loaded on cron invocation. No measurable cold-start cost.

`npx tsc --noEmit`: 0 errors. Confirmed.

Tech debt scan on new files: 0 `console.*`, 0 `TODO/FIXME`, 0 `@ts-ignore`, 0 `: any`. Clean.

---

## CRITICAL

None.

---

## HIGH

### HIGH-1 — SQL dump emits raw column names; reserved keywords + special chars in identifiers will break restore

**File:** `src/forest/dr/d1-dump-builder.ts:107,110`

Current emission:
```ts
const columnList = columns.map((c) => `"${c}"`).join(', ');
lines.push(`INSERT INTO "${tableName}" (${columnList}) VALUES`);
```

This double-quotes identifiers (SQLite-compatible) — good baseline. But the column/table names are interpolated raw. If a column name contains a literal `"` (rare but legal in SQLite if originally created with `"col""name"`), the emitted SQL is malformed: `INSERT INTO "users" ("col"name", ...)`.

Same applies to table names with `"` or special chars. SQLite allows these via double-quoted creation but our output breaks.

**Impact:** Low blast radius in our schema today (snake_case identifiers, no `"`) — but the restore script (`d1 execute --file=`) would silently fail on the affected table on a future schema change. We won't notice until DR drill.

**Fix:**
```ts
function quoteIdent(name: string): string {
  return '"' + name.replaceAll('"', '""') + '"';
}
// Then:
const columnList = columns.map(quoteIdent).join(', ');
lines.push(`INSERT INTO ${quoteIdent(tableName)} (${columnList}) VALUES`);
```

Add a test: `quoteIdent('col"name')` → `'"col""name"'`.

### HIGH-2 — In-memory buffering of full dump risks Worker OOM at scale (no size guard)

**File:** `src/app/api/cron/d1-backup/route.ts:84-86`

```ts
const dump = await buildD1Dump(db);
const bytes = new TextEncoder().encode(dump);
await bucket.put(objectKey, bytes, { ... });
```

The entire dump is constructed as a single string in memory, then encoded to Uint8Array (transient duplication = 2× peak memory). Cloudflare Worker memory limit is 128 MB. Estimated current row count is small (4087 tests assume modest fixtures, prod likely <100k total rows) — but `MAX_ROWS_PER_TABLE = 100_000` × N tables × ~500 bytes/row could easily approach 50–100 MB peak.

**Impact:** Silent OOM kill = Worker returns 500, `recordCronRun(failure)`, BetterStack fatal log fires. Observable but ugly. Cron loops dead until manual intervention.

**Fixes (pick one):**

A) **Cheap mitigation — add size guard and explicit error:**
```ts
const MAX_DUMP_BYTES = 50 * 1024 * 1024; // 50 MiB safety ceiling
if (bytes.byteLength > MAX_DUMP_BYTES) {
  throw new Error(`Dump size ${bytes.byteLength} exceeds ${MAX_DUMP_BYTES} budget — switch to streaming or pagination`);
}
```

B) **Proper fix (future) — stream per-table dumps to R2 multipart upload:**
- Build dump in chunks per table.
- Use `bucket.createMultipartUpload()` → upload parts as each table completes.

Recommend (A) now (5-min fix) + ticket for (B) next quarter.

---

## MEDIUM

### MED-1 — SOP 14 instructs operator to set `QSTASH_CURRENT_SIGNING_KEY` but the Worker route never validates QStash signature

**File:** `docs/dev-sops.md:403-404`

Setup says:
```bash
echo "<your-signing-key>" | npx wrangler secret put QSTASH_CURRENT_SIGNING_KEY
```

But `grep -r QSTASH_CURRENT_SIGNING_KEY src/` returns 0 hits. The route relies solely on `CRON_SECRET` via `x-cron-secret` header forwarded by QStash. The signing key is dead weight + creates a false sense of security.

**Fix options:**
- A) Remove the line from SOP 14 (recommended — `CRON_SECRET` via `Upstash-Forward-x-cron-secret` is sufficient, and it's the design choice consistent with the rest of the cron stack).
- B) Add real QStash signature verification middleware (uses `@upstash/qstash` SDK) — extra dep, extra complexity, redundant with `CRON_SECRET`.

Pick (A). Add a note: "We use Bearer-forwarded `CRON_SECRET` rather than QStash signature for parity with the other cron routes."

### MED-2 — SOP 15 DR drill missing the `apply-migrations.sh` warning the user explicitly asked about

**File:** `docs/dev-sops.md:454-457`

Step 3 uses `wrangler d1 migrations apply sophia-raas-db-drill --remote` which DOES bootstrap schema. ✅ Good.

But the wrapper script `scripts/apply-migrations.sh` is the canonical migration runner per `apps/sophia-ai-factory/CLAUDE.md`. Using raw `wrangler d1 migrations apply` will diverge from how prod gets migrated. If `apply-migrations.sh` has logic the wrangler subcommand lacks (e.g. SHA pinning, ordering), the drill DB won't match prod.

**Fix:** Replace step 3:
```bash
# Apply migrations to drill DB using the canonical script
DRILL_DB_NAME=sophia-raas-db-drill bash scripts/apply-migrations.sh
```

…OR add a note explaining why raw `migrations apply` is acceptable here.

### MED-3 — Idempotency window `skipped` response is silent to BetterStack — operator can't tell drift from real success

**File:** `src/app/api/cron/d1-backup/route.ts:70-73`

```ts
if (alreadyRan) {
  return NextResponse.json({ ok: true, skipped: true, reason: 'recently_run' });
}
```

Cases this triggers in production:
- Operator hits the endpoint manually after a successful 03:00 run → returns `skipped`. **Desirable.**
- QStash retries fire twice within 12h → returns `skipped`. **Desirable.**

But: no heartbeat is pushed on skip. BetterStack monitor configured for "no ping for >36h triggers alert" won't fire (skipped path still happens daily), so this is OK in practice. Only edge case: if cron fires at 03:00 but route returns `skipped` because of clock issue / stale `cron_run_log`, no new dump is written for that day. **Recommend: still ping heartbeat on skipped path** so operator sees "alive but no-op" telemetry, AND log a `recordCronRun(skipped)` for observability.

```ts
if (alreadyRan) {
  // Skip is success-equivalent — still ping heartbeat + record so dashboards reflect liveness
  if (env.BACKUP_HEARTBEAT_URL) {
    await pushHeartbeat(env.BACKUP_HEARTBEAT_URL).catch(() => {});
  }
  await recordCronRun(db, CRON_NAME, 'skipped');
  return NextResponse.json({ ok: true, skipped: true, reason: 'recently_run' });
}
```

### MED-4 — Empty-table comment uses unquoted identifier, inconsistent with INSERT line

**File:** `src/forest/dr/d1-dump-builder.ts:99`

```ts
lines.push(`-- Table ${tableName}: empty`);
```

vs.
```ts
lines.push(`-- Table: ${tableName} (${rows.length} rows...)`);  // line 109 uses different format
```

Two different comment formats. Minor inconsistency. Pick one shape. Suggest matching line 109:
```ts
lines.push(`-- Table: ${tableName} (empty)`);
```

---

## LOW

### LOW-1 — `configure-upstash-qstash.sh` doesn't URL-encode the destination

**File:** `scripts/dr/configure-upstash-qstash.sh:26`

The destination URL is appended raw to the QStash schedules path:
```
https://qstash.upstash.io/v2/schedules/${ENDPOINT}
```

`ENDPOINT` contains `://` and `/` — QStash API actually accepts this format (their docs show it), so this works for our specific URL. But if the endpoint ever contains query params or fragments, it breaks. Cosmetic.

### LOW-2 — `Idempotency` check window 12h: ambiguous interaction with restoring from disaster

**File:** `src/app/api/cron/d1-backup/route.ts:30`

If a disaster wipes `cron_run_log`, idempotency check returns "not recently run" (correct fallback at line 76 of `run-tracker.ts`: "fail open"). After restore, the first invocation will run a fresh backup. ✅ Correct behavior. But undocumented in SOP 14. Add a note: "Idempotency state lives in D1 itself — post-disaster restore + next QStash fire = automatic new backup."

---

## Edge Cases Found by Scout

1. **NULL bytes in strings (`\0`):** `sqlEscape` uses `String(value).replaceAll("'", "''")`. SQLite tolerates `\0` in string literals when wrapped in single quotes but `wrangler d1 execute --file=` may strip them depending on shell. Not a confirmed bug in our schema (no NULL-byte data in user tables today) but worth a guard test.
2. **Backslashes in strings:** SQLite does NOT use backslash escaping by default (no `PRAGMA case_sensitive_like` or similar). Doubling single quotes is sufficient per SQLite spec. ✅ `sqlEscape` is correct here.
3. **Multi-value INSERT syntax:** `INSERT INTO t (cols) VALUES (...), (...);` — SQLite supports this since 3.7.11 (2012). D1 ships much newer than that. ✅ Safe.
4. **`d1_migrations` skip:** Confirmed in `SQLITE_INTERNAL_TABLES` set. ✅ Restore won't clobber migration ledger. ⚠️ But SOP 15 step 3 runs migrations BEFORE restore, which creates `d1_migrations` rows. Then step 4 restores user-table inserts — does not touch `d1_migrations`. ✅ Correct sequencing.
5. **`sqlite_master` filter:** Query uses `name NOT LIKE 'sqlite_%'` PLUS the in-memory `SQLITE_INTERNAL_TABLES` set. Belt + suspenders. ✅
6. **Empty `results` array:** Guarded via `?? []` at line 89 and 97. ✅
7. **Schema-only dump:** This dump is DATA only. Restore procedure (SOP 15 step 3) runs migrations FIRST to create schema, THEN step 4 inserts data. **Critical that this ordering is preserved in SOP 15.** Confirmed in current SOP. ✅
8. **Row order vs FK constraints:** Tables dumped in alphabetical order (`ORDER BY name` in introspection query). If table B has FK referencing table A, and B comes alphabetically before A, restore will fail with FK constraint error. Need to verify our schema's table names don't trigger this. Suggest: future enhancement to topo-sort by FK dependency, OR document operator workaround `PRAGMA foreign_keys = OFF; ...; PRAGMA foreign_keys = ON;` for restore. ⚠️ Worth adding to SOP 15.

---

## Positive Observations

- **`forest/dr/` placement is correct.** Per `sophia-layer-architecture.md`, forest = reusable infrastructure orchestrators. Backup is exactly that. ✅
- **Test coverage on `sqlEscape` and `buildD1Dump`** is appropriate: covers nulls, strings with quotes, BigInt, ArrayBuffer, multi-table dump, empty tables. ✅
- **Idempotency window** matches the design of other cron routes (`hourly-rollup`, `heartbeat`). ✅
- **`recordCronRun` on both success AND failure** — observability symmetry ✅
- **`pushFatalLog` on error path** matches the pattern in `heartbeat/route.ts:71`. ✅
- **30-day R2 lifecycle** documented in wrangler comment and SOP 14. Confirmed via `wrangler r2 bucket lifecycle list`. ✅
- **Polar references: 0.** Confirmed via grep. NOWPayments doctrine intact. ✅
- **No CI/migration impact.** Phase 4 adds 0 SQL migration files. `apply-migrations.sh` does not need to run post-deploy.
- **CF-direct doctrine respected.** Workflow archived as `.disabled` (per pattern set by `test.yml.disabled`).
- **Operator script is `set -euo pipefail` + exit on missing token.** Good shell hygiene. ✅

---

## Doctrine Compliance Matrix

| Check | Status |
|---|---|
| Layer placement: forest/dr/ for orchestrator | ✅ |
| Layer placement: route in app/api/cron/ | ✅ |
| `:any` types in production code | ✅ Zero |
| `console.*` in production code | ✅ Zero |
| `TODO/FIXME` left behind | ✅ Zero |
| Polar references | ✅ Zero (NOWPayments-only) |
| File size ≤ 200 lines | ✅ All under (max 124) |
| Kebab-case file names | ✅ |
| Test file alongside source | ✅ |
| CF-direct doctrine (no GH Actions for deploy) | ✅ Workflow archived |
| `apply-migrations.sh` required post-deploy | ✅ N/A (no migrations) |
| Phase score target 87 → 91 | ✅ Plausible — bumps "Backup 💾" layer to ~8/10 |

---

## Anti-Regression Check

- Tests ignored: NO — `nowpayments-payout` flake noted; pre-existed Phase 4 (unrelated).
- Type errors: 0.
- Lint regressions: 421 warnings, within budget per request.
- New routes added to `inject-scheduled-handler.mjs` CRON_ROUTES map: ⚠️ **NOT REQUIRED** for this phase because QStash dispatches via HTTP (external), not CF scheduled() handler. **Confirmed correct.**
- R2 binding type narrows via global `declare abstract class R2Bucket` from `worker-configuration.d.ts`. ✅
- D1 binding pattern (`globalThis as unknown as Env`) matches `heartbeat/route.ts` precedent. ✅

---

## Recommended Action List (Priority Order)

1. **(HIGH-1)** Add `quoteIdent()` helper to `d1-dump-builder.ts` + test case for column name with embedded `"`. ~10 min.
2. **(HIGH-2)** Add `MAX_DUMP_BYTES` size guard before `bucket.put` to fail fast with descriptive error rather than OOM-kill. ~5 min.
3. **(MED-1)** Remove `QSTASH_CURRENT_SIGNING_KEY` line from SOP 14 setup checklist — it's unused. ~2 min.
4. **(MED-2)** Switch SOP 15 step 3 to `DRILL_DB_NAME=... bash scripts/apply-migrations.sh` for parity with prod migration path. ~3 min.
5. **(MED-3)** Push heartbeat + record `skipped` status in the idempotency branch. ~5 min.
6. **(MED-4)** Normalize empty-table comment format to match the row-count line. ~1 min.
7. **(LOW)** Append FK ordering note to SOP 15 (use `PRAGMA foreign_keys = OFF` if restore fails with FK error).
8. **(LOW)** Document "post-disaster cron_run_log loss → first QStash fire after restore creates new backup automatically" in SOP 14.

---

## Metrics

- New LOC (production): 244 (route + dump builder)
- New LOC (tests): 116
- New LOC (docs): 113
- New LOC (scripts): 42
- Test/code ratio (new code): 0.48 — acceptable for orchestration + pure-function split.
- Type coverage: 100% (0 `: any`).
- Linting: 0 errors, +0 warnings vs. pre-Phase 4 baseline.

---

## Unresolved Questions

1. **Schema-aware sort:** Do we want topological FK sort for restore, or accept SOP 15 workaround (`PRAGMA foreign_keys = OFF`)? The simpler doctrine is the PRAGMA; full topo-sort is over-engineering until we hit a real FK in a real restore.
2. **R2 cost cap:** With 30-day retention and ~1 file/day, R2 storage stays well under free tier (10 GB) until total daily dump size exceeds ~330 MB sustained. No action needed today, but worth noting in SOP 14 "Monitoring" section.
3. **Drill schedule auto-reminder:** SOP 15 says "quarterly" — do we want a GH Actions reminder issue, calendar entry, or operator notebook ping? Currently nothing automates this — relying on operator discipline.
4. **D1 read consistency during long dump:** D1 has eventual consistency across replicas. A multi-second dump can see inconsistent snapshots across tables (table A read at t=0, table B read at t=5s, with writes in between). Whether to wrap the dump in a single read transaction (D1 doesn't formally support cross-table read transactions yet — see `D1DatabaseSession`) is an open question. For now, the 1% tolerance in SOP 15 step 5 covers this. Worth tracking.

---

**Ship decision:** APPROVE_WITH_FIXES. Ship now; queue HIGH-1/HIGH-2 + the MED items as a follow-up Phase 4.1 cleanup before the first DR drill.
