# Cron Infrastructure Go-Live — Plan

**Status:** Verifying (P01+P04 deployed, P02 monitoring in progress)  
**Branch:** main  
**Deployed:** SHA `262e1b1f` (verified via /api/version)  
**Goal:** Fix 3 critical infrastructure gaps preventing cron jobs from firing in production.

## Context

Plan `260502-0604-raas-fulfillment-zero-fail` shipped new cron routes. Audit found:
1. `cron_runs` table missing on remote D1 → `recordCronRun` writes silently fail
2. OpenNext worker.js has no `scheduled()` export → CF Workers cron triggers hit nothing
3. Root `wrangler.jsonc` missing new cron patterns → `*/2`, `*/15`, `0 6 * * *` not registered

## Features

| ID  | Feature                          | Status      |
|-----|----------------------------------|-------------|
| F11 | `cron_runs` D1 table + migration | [x] Complete |
| F12 | `scheduled()` handler post-build | [x] Complete |
| F13 | Root `wrangler.jsonc` cron list  | [x] Complete |

## P04 Latent Fixes (added 260502)

| ID  | Fix                                       | Status      |
|-----|-------------------------------------------|-------------|
| L1  | `is_onboarding` column migration 0045     | [x] Complete — applied local + remote |
| L2  | Supabase billing_events unique index 0044 | [!] Manual step required (no auth token) |
| L3  | `deploy-with-sha.sh` script               | [x] Complete |

## Phases

| Phase | Item | Status |
|-------|------|--------|
| P01 | [Cron Infrastructure](./phase-01-cron-infrastructure.md) | ✅ Complete |
| P02 | Cron Schedule Verification | 🟡 Verifying (monitoring cron_run_log) |
| P03 | Real-Money Smoke Test Playbook | ✅ Delivered |
| P04 | Latent Fixes (migrations + deploy script) | ✅ Complete |

## Deployment

- **Commit SHA:** `262e1b1f`
- **Route:** Confirmed via `curl https://sophia.agencyos.network/api/version`
- **D1 Status:** `cron_runs` table exists (SELECT verified)
- **Worker Handler:** `.open-next/worker.js` exports `scheduled()`
- **Cron Patterns:** 10 entries in `wrangler.jsonc`

## Success Criteria

- [x] `cron_runs` table exists on remote D1
- [x] `.open-next/worker.js` exports `scheduled` after build
- [x] Root `wrangler.jsonc` contains all 10 cron patterns
- [x] `npm run build` exits 0
- [x] `npm test` passes all 2205+ tests
- [x] Deploy GREEN (SHA matches, /api/version correct)
- [ ] P02: Verify `*/2` fulfillment-retry fires (awaiting next cron window)
