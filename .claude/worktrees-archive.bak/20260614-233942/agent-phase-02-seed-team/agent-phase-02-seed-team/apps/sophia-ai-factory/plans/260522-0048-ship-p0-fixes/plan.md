# Ship P0 Fixes — Plan

Source: phase4-tech-debt.md + phase5-go-live-scorecard.md (audit 260521-2342).
Goal: drive Go-Live score 67 → 75+ by closing 8 P0 blockers.
Mode: `/goal --deep --auto`.

## Waves

### Wave A — Parallel-safe (5 fixes)
| ID | Phase | Files | Risk |
|----|------|-------|------|
| V-1.1 | phase-01-idor-campaigns-retry-resume.md | `src/app/actions/campaigns-retry-resume.ts` | low |
| V-1.2 | phase-02-raas-api-key-userbind.md | `src/app/api/v1/campaigns/create/route.ts` + RaaS validator | low |
| D-5.1 | phase-03-nextjs-bump.md | `package.json`, lockfile | low (rebuild required) |
| GAP-R1 | phase-04-d1-backup-cron-wire.md | `scripts/inject-scheduled-handler.mjs` | low |
| GAP-R3 | phase-05-publish-execute-idempotent.md | `src/forest/inngest/functions/publish-execute.ts` | low |

### Wave B — Gated (3 fixes, irreversible — user signoff before commit/migrate)
| ID | Phase | Concern |
|----|------|---------|
| V-1.3 | phase-06-org-id-schema.md | prod D1 migration + backfill source for signals_events |
| V-2.1 | phase-07-aes-gcm-aad.md | re-encrypt existing BYOK rows OR dual-decrypt path |
| GAP-R2 | phase-08-migration-tracking-baseline.md | replay risk; needs `INSERT INTO d1_migrations` baselines |

## Execution

- Wave A: parallel via 5 agents, all land on `master` after tests pass
- Wave B: research first, present diff + rollback plan, gate on user explicit "ship"
- Deploy: single `npm run deploy:full` per wave after all tests green
- Verification: SHA match + curl 200 + smoke per `sophia-deploy-verify.md`

## Success criteria

- 5 Wave-A P0s shipped to prod (SHA bumps from `d86659bf`)
- 3 Wave-B P0s have signed-off plans + dry-run results
- New score ≥ 75/100 honest
