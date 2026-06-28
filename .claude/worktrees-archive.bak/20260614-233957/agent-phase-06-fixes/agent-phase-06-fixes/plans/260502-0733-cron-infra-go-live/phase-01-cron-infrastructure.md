# Phase 01 — Cron Infrastructure

**Priority:** Critical  
**Status:** Complete (P01 + P04 latent fixes) — Deployed SHA `262e1b1f` 2026-05-02 07:33
**Completed Timestamp:** 2026-05-02 09:15 UTC

## Context

- `run-tracker.ts` uses `cron_run_log` (migration 0026, already on remote)
- New `cron_runs` table: richer tracking (id PK, duration_ms, metadata JSON)
- `scheduled()` missing from worker.js — CF cron triggers fire into void
- Root `wrangler.jsonc` missing `*/2`, `*/15`, `0 6 * * *`

## File Ownership

- `apps/sophia-ai-factory/migrations/0044-cron-runs-table.sql` (CREATE)
- `apps/sophia-ai-factory/scripts/inject-scheduled-handler.mjs` (CREATE)
- `apps/sophia-ai-factory/package.json` (MODIFY deploy script)
- `wrangler.jsonc` (MODIFY cron list)

## Todo List

### F11: Cron Runs Table
- [x] Create migration 0044-cron-runs-table.sql (2026-05-02 07:35)
- [x] Apply migration locally (2026-05-02 07:38)
- [x] Apply migration remotely (2026-05-02 07:42)

### F12: Scheduled Handler
- [x] Create inject-scheduled-handler.mjs (2026-05-02 07:45)
- [x] Update package.json deploy script (2026-05-02 07:48)
- [x] Critical fix: switched to `env.WORKER_SELF_REFERENCE.fetch` (was global fetch, failed DNS) (2026-05-02 08:05)

### F13: Wrangler Cron
- [x] Update wrangler.jsonc cron list (2026-05-02 07:52)

## P04 Latent Fixes (added 260502)

### L1: is_onboarding Column Restoration
- [x] Create migration 0045-videos-is-onboarding.sql (column dropped in 0043 rebuild) (2026-05-02 08:10)
- [x] Apply 0045 locally (2026-05-02 08:12)
- [x] Apply 0045 remotely (219 rows read, 1 written — column added) (2026-05-02 08:18)

### L2: Billing Events Compensation Unique Index
- [!] Supabase migration 260502-0800-billing-events-compensation-unique.sql
  - MANUAL STEP: no auth token / Docker not running
  - Manual SQL instructions documented in migration file header
  - Deferred for manual execution when Supabase CLI auth available

### L3: Deploy Script with SHA/Branch/Timestamp
- [x] Create scripts/deploy-with-sha.sh (macOS-safe, bash -n: Syntax OK) (2026-05-02 08:22)
- [x] Add deploy:full to package.json scripts (2026-05-02 08:25)
- [x] Script sets COMMIT_SHA, DEPLOYED_AT, DEPLOY_BRANCH secrets before wrangler deploy (2026-05-02 08:30)

### Build & Test
- [x] npm run build: exit 0 (2026-05-02 08:35)
- [x] npm test: 2205 passed, 31 skipped (2026-05-02 08:40)

## Success Criteria

- [x] `SELECT name FROM sqlite_master WHERE type='table' AND name='cron_runs'` returns row on remote
- [x] `grep "scheduled" .open-next/worker.js` finds export after build
- [x] wrangler.jsonc has 10 cron entries
- [x] `npm run build` exits 0
- [x] `npm test` passes (2205 passed, 31 skipped)
- [x] Deploy GREEN: SHA `262e1b1f` matches /api/version
- [x] Worker dispatch fix: `env.WORKER_SELF_REFERENCE.fetch` resolves DNS correctly

## Route Map (Actual Paths)

| Pattern | Route |
|---------|-------|
| `*/5 * * * *` | `/api/cron/uptime-check` + `/api/cron/video-status-sync` |
| `5 * * * *` | `/api/cron/usage-export` |
| `0 1 * * *` | `/api/cron/dunning-advance` |
| `0 2 * * *` | `/api/cron/subscription-reminders` |
| `0 3 * * *` | `/api/cron/scheduled-campaigns` |
| `0 4 * * *` | `/api/cron/email-drip` |
| `0 6 * * 1` | `/api/cron/weekly-signals-digest` |
| `*/2 * * * *` | `/api/cron/fulfillment-retry` |
| `*/15 * * * *` | `/api/cron/smoke-one-time` |
| `0 6 * * *` | `/api/cron/fulfillment-reconcile` |
