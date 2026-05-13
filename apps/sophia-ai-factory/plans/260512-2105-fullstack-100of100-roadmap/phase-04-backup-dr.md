# Phase 4: Backup & DR

## Context Links

- Audit: `plans/reports/debugger-260512-2058-fullstack-audit-rescore.md` §4 G1/G14
- Audit Layer 10 (Backup) — 5/10 — `d1-backup.yml` has 0 runs ever
- Existing scripts: `scripts/dr/d1-snapshot.sh`, `scripts/dr/restore-from-snapshot.sh`
- RPO/RTO from Phase 1: `docs/deployment-guide.md`
- Upstash QStash: https://upstash.com/docs/qstash
- CF Workers Cron: https://developers.cloudflare.com/workers/configuration/cron-triggers/

## Overview

- **Priority:** P1
- **Status:** pending (depends on Phase 1 G7 RPO/RTO docs)
- **Brief:** Move D1 backup automation off blocked GH Actions onto external/CF cron. Document DR drill SOP.
- **Effort:** ~4h
- **Score impact:** +2 (87 → 91 cumulative — assumes Phases 1-3 complete)

## Key Insights

| Gap | Insight |
|-----|---------|
| G1 | `d1-backup.yml` workflow exists with 0 runs — GH account blocks scheduled workflows. CF-direct doctrine forbids GH reliance. **MUST move to alternative cron.** Two viable options analyzed below. |
| G14 | DR drill not scheduled. Need quarterly cadence: restore latest backup to a test D1 (not prod), validate row counts + schema. SOP entry sufficient — actual drill can wait for next quarter. |

### G1 Cron Option Analysis

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **A. CF Workers Cron** | Native to stack, no extra service, free | Worker can't easily run `wrangler d1 export` (that's a CLI op). Would need REST API to D1 + manual SQL dump construction OR external endpoint that triggers a Mac/server | ⚠️ Architecturally awkward |
| **B. Upstash QStash** | Reliable HTTP cron, free tier 500/day, has retries, signing for auth | Adds external dep + secret to manage | ✅ **RECOMMENDED** |
| **C. Cron on operator machine (launchd/cron)** | Free, simple shell script | Depends on Mac being online; single point of failure | ❌ Not production-grade |
| **D. fly.io scheduled machine** | Cheap, reliable | Adds another vendor | Acceptable but unnecessary |

**Decision: Option B (Upstash QStash) calling a Sophia API route `/api/cron/d1-backup` (CRON_SECRET protected) that triggers the export-and-upload-to-R2 logic from within the Worker.**

### Worker-based D1 Export Approach

CF Workers cannot shell out to `wrangler d1 export`. Instead:
1. Worker uses D1 binding to `SELECT name FROM sqlite_master WHERE type='table'`
2. For each table: `SELECT * FROM <table>` → serialize as SQL INSERT statements
3. Stream output to R2 bucket `sophia-backups` with timestamp key
4. POST heartbeat to BetterStack on success

**Trade-off:** Worker SQL-dump is slower and more complex than `wrangler d1 export`, but stays inside CF stack and works around the GH block. Acceptable for daily backup (one D1 has ~107 migrations worth of tables; runtime estimated 30s-2min).

## Requirements

**Functional:**
- F1: Daily D1 backup runs at 03:00 UTC (low-traffic window)
- F2: Backup uploads to R2 `sophia-backups/d1-<YYYY-MM-DD>.sql` with 30-day retention
- F3: On failure: BetterStack alert fires, Sentry error logged
- F4: DR drill SOP documented in `docs/dev-sops.md` — quarterly schedule
- F5: Manual restore SOP cross-references existing `scripts/dr/restore-from-snapshot.sh`

**Non-functional:**
- Backup runtime < 5min
- R2 storage cost < $1/month for 30 days of dumps
- Cron auth via CRON_SECRET (per existing `src/seed/security/cron-auth.ts`)

## Architecture

```
Upstash QStash (cron)
  └─► HTTP POST https://sophia.agencyos.network/api/cron/d1-backup
      headers: x-cron-secret: <CRON_SECRET>
      └─► Sophia Worker
          ├─► verifyCronSecret() (existing util)
          ├─► const tables = DB.prepare("SELECT name FROM sqlite_master ...").all()
          ├─► for each table: SELECT * → assemble SQL INSERTs
          ├─► R2 PUT sophia-backups/d1-YYYY-MM-DD.sql
          ├─► R2 lifecycle: delete after 30d (configured on bucket)
          └─► BetterStack heartbeat ping on success
                  OR: Sentry capture on failure
```

## Related Code Files

**Modify:**
- `wrangler.toml` — confirm R2 binding for `sophia-backups` exists (add if missing)
- `docs/dev-sops.md` — add SOP 12 (DR drill) + SOP 13 (Upstash cron setup)
- `docs/deployment-guide.md` — reference new backup mechanism

**Create:**
- `src/app/api/cron/d1-backup/route.ts` — new Worker route
- `src/forest/dr/d1-dump-builder.ts` — table dump SQL serializer (forest layer — orchestration role)
- `scripts/dr/configure-upstash-qstash.sh` — one-shot script to register cron via QStash CLI/API

**Delete (or rename):**
- `.github/workflows/d1-backup.yml` → `.github/workflows/d1-backup.yml.disabled` (per existing CF-direct doctrine of archiving)

## Implementation Steps

1. **Verify R2 bucket** — check `wrangler.toml` for `sophia-backups` binding; create if absent:
   ```bash
   npx wrangler r2 bucket create sophia-backups
   ```
   Add binding to `wrangler.toml`:
   ```toml
   [[r2_buckets]]
   binding = "BACKUPS_BUCKET"
   bucket_name = "sophia-backups"
   ```
2. **R2 lifecycle** — set 30-day expiration on `sophia-backups`:
   ```bash
   npx wrangler r2 bucket lifecycle add sophia-backups --json '<rule>'
   ```
3. **Create dump builder** — `src/forest/dr/d1-dump-builder.ts`:
   - Function `buildD1Dump(db: D1Database): Promise<string>` returns SQL text
   - Iterates `sqlite_master` for tables (skip sqlite_sequence, etc.)
   - For each: `SELECT *` and emit `INSERT INTO ... VALUES (...)` lines
   - Escapes strings, handles NULL, blobs (base64 if any)
4. **Create cron route** — `src/app/api/cron/d1-backup/route.ts`:
   - Verify `CRON_SECRET` header
   - Call `buildD1Dump()`
   - PUT to R2 with key `d1-${new Date().toISOString().slice(0,10)}.sql`
   - Push BetterStack heartbeat ping (separate URL or use `BACKUP_HEARTBEAT_URL`)
   - On error: `Sentry.captureException(err)` + return 500
5. **Test locally** — `npm run dev` → curl with CRON_SECRET → verify R2 contains dump (use wrangler r2 list).
6. **Deploy** — `npm run deploy:full` + SHA verify.
7. **Upstash QStash setup** — sign up, create schedule:
   ```bash
   curl -X POST "https://qstash.upstash.io/v2/schedules/https://sophia.agencyos.network/api/cron/d1-backup" \
     -H "Authorization: Bearer $QSTASH_TOKEN" \
     -H "Upstash-Cron: 0 3 * * *" \
     -H "Upstash-Forward-x-cron-secret: $CRON_SECRET"
   ```
   Save command in `scripts/dr/configure-upstash-qstash.sh`.
8. **Wait for first scheduled run** (next 03:00 UTC), verify R2 object exists.
9. **Test restore path** — manually download latest dump, run against test D1 via `wrangler d1 execute`, verify row counts match prod (sample 3 tables).
10. **G14 SOP** — add SOP 12 "DR Drill (Quarterly)" to `docs/dev-sops.md`:
    - Q1/Q2/Q3/Q4 schedule
    - Steps: spin up test D1 → restore latest → diff row counts → document RTO actual
    - Acceptance: RTO ≤ 4h actual on drill
11. **Archive old workflow** — `git mv .github/workflows/d1-backup.yml .github/workflows/d1-backup.yml.disabled`.
12. **Commit** — `feat(dr): worker-based D1 backup via Upstash cron + DR drill SOP`.
13. **Update changelog** — `docs/project-changelog.md`.

## Todo List

- [ ] Verify/create R2 bucket `sophia-backups` + binding
- [ ] Set R2 lifecycle (30-day expiration)
- [ ] Create `src/forest/dr/d1-dump-builder.ts` (table → SQL INSERT serializer)
- [ ] Create `src/app/api/cron/d1-backup/route.ts` (CRON_SECRET protected)
- [ ] Add tests for `buildD1Dump()` (small fixture, verify SQL output)
- [ ] Local smoke test (npm run dev + curl)
- [ ] Deploy with SHA verify
- [ ] Sign up Upstash + obtain QSTASH_TOKEN
- [ ] Store QSTASH_TOKEN in CF secrets (`wrangler secret put`)
- [ ] Register schedule via QStash API + save script
- [ ] Wait for first scheduled run (next 03:00 UTC) + verify R2 object
- [ ] Test restore path (download → test D1 → diff)
- [ ] Add SOP 12 (DR drill quarterly) to `docs/dev-sops.md`
- [ ] Archive `.github/workflows/d1-backup.yml` → `.disabled`
- [ ] Update `docs/deployment-guide.md` with new backup architecture
- [ ] Update `docs/project-changelog.md`

## Success Criteria

- R2 contains `d1-YYYY-MM-DD.sql` object after first cron run
- Object size > 0, valid SQL (sample download + grep `INSERT INTO`)
- BetterStack receives heartbeat ping
- Manual restore test passes (row counts match within tolerance)
- SOP 12 exists in `dev-sops.md`
- Old `d1-backup.yml` archived to `.disabled`
- Cumulative score reaches 91/100

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Worker hits CPU limit on large D1 dump | Stream chunks; if needed, split per-table into separate R2 objects |
| QStash free tier (500 req/day) insufficient | 1 req/day for daily backup — well within free limit |
| Dump format incompatibility with restore | Test restore on day 1; adjust serializer if needed |
| CRON_SECRET leakage via QStash forwarding | Rotate secret if QStash breach; use signed QStash messages as second factor |
| R2 storage cost balloons | 30-day lifecycle keeps cost bounded; estimate <$1/mo for ~30 dumps |
| Cron stops without notice | BetterStack heartbeat monitor alerts on missed pings |

## Security Considerations

- CRON_SECRET protects `/api/cron/d1-backup` from public access
- QStash signing key (`QSTASH_SIGNING_KEY`) can add cryptographic verification on top
- R2 bucket private by default; access via Worker binding only
- Backup contains PII — ensure R2 bucket not publicly readable
- DR drill on TEST D1 only — never overwrite prod D1

## Next Steps

- **Phase 5** can run after this — independent
- Future: extend cron to weekly full + daily incremental once volume grows
- Consider adding KV state backup similarly (low priority)
- Document RTO actual after first drill, update Phase 1 RPO/RTO if needed
