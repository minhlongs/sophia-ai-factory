---
title: "Phase 06 — Deploy Checklist Verification"
description: "Automated deploy checklist script verifying all hardening seams before production deploy."
status: TODO
priority: P1
effort: 3h
branch: main
tags: [deploy, checklist, verification, automation]
created: 2026-08-16
---

# Phase 06 — Deploy Checklist Verification

## Context Links

- Deploy entry point: `scripts/deploy-full-verified.sh` (called by `npm run deploy:full`)
- Deploy with SHA: `scripts/deploy-with-sha.sh` (660 lines, main deploy logic)
- Deploy verification: `.claude/rules/sophia-deploy-verify.md`
- Pre-deploy gate: `scripts/pre-deploy-gate.mjs`
- Post-deploy smoke: `scripts/post-deploy-smoke.mjs`
- Verify production: `scripts/verify-production-deploy.sh`
- Health endpoint: Phase 03 (`src/app/api/health/route.ts`)
- Circuit breaker: Phase 01 (`src/seed/security/circuit-breaker.ts`)
- Stryker baseline: Phase 02 (`stryker-baseline.json`)
- Lock reaper: Phase 05 (`src/seed/utils/d1-lock-reaper.ts`)

## Overview

**Priority:** P1
**Status:** TODO
**Description:** Create an automated deploy checklist verification script that runs all hardening seam checks before production deploy. The script validates: health endpoint, version match, circuit breaker state, audit trail health, lock health, and mutation score threshold. Blocks deploy on failure, allows `FORCE_DEPLOY=1` escape hatch with mandatory justification.

## Key Insights

- Current deploy flow: `npm run deploy:full` runs `deploy-full-verified.sh` → `deploy-with-sha.sh`
- `deploy-full-verified.sh` enforces clean tree, requires `E2E_TEST_USER_PASSWORD`, calls `deploy-with-sha.sh` + `test:e2e:go-live` + `verify-production-deploy.sh`
- `deploy-with-sha.sh` already has pre-deploy gate (type-check, lint, tests) at ~660 lines
- `pre-deploy-gate.mjs` and `post-deploy-smoke.mjs` exist but may not cover all hardening seams
- Gap: no unified checklist that verifies ALL hardening seams (circuit breaker, mutation score, audit trail, locks) in one pass
- `FORCE_DEPLOY=1` with `JUSTIFICATION` env var bypasses checklist
- Checklist runs pre-deploy (before `wrangler deploy`) and post-deploy (after live)
- Existing verify sequence in `sophia-deploy-verify.md` checks: SHA match, HTTP 200, migrations

## Requirements

### Functional
1. `scripts/deploy-checklist-verify.sh` — runs all checklist items
2. Pre-deploy checks (local):
   - Build passes (`npm run build`)
   - Tests pass (`npm test`)
   - Type-check passes (`npm run type-check`)
   - Lint passes (`npm run lint`)
   - Circuit breaker config valid (D1 migration exists)
   - Stryker baseline exists and score `>=70%`
   - Lock reaper config valid
3. Post-deploy checks (live):
   - `/api/health` returns 200 with `"status": "healthy"` or `"degraded"`
   - `/api/version` `shortSha` matches local commit
   - Circuit breaker state is `"closed"` (no open circuits across all services)
   - Audit trail health check returns 200
   - Lock reaper logs show no stale locks in last 5 min
4. `FORCE_DEPLOY=1` with `JUSTIFICATION` env var bypasses checklist
5. Checklist output: structured JSON + human-readable summary
6. Exit code: 0 on all-pass, 1 on any failure

### Non-functional
1. Checklist completes in < 30 seconds (pre-deploy) + < 60 seconds (post-deploy)
2. No external dependencies beyond existing scripts
3. Checklist is idempotent — safe to run multiple times
4. Escape hatch requires explicit justification (logged for audit)

## Architecture

```
┌─────────────────────────────────────────────────┐
│  deploy-checklist-verify.sh                      │
│  ├── Phase: pre-deploy (local)                   │
│  │   ├── npm run build                           │
│  │   ├── npm test                                │
│  │   ├── npm run type-check                      │
│  │   ├── npm run lint                            │
│  │   ├── Check stryker-baseline.json exists      │
│  │   ├── Verify circuit breaker D1 migration     │
│  │   └── Verify lock reaper config               │
│  ├── Phase: post-deploy (live)                   │
│  │   ├── curl /api/health → status check          │
│  │   ├── curl /api/version → shortSha match      │
│  │   ├── curl /api/health → circuit closed        │
│  │   ├── curl /api/admin/byok-audit/health → 200 │
│  │   └── Check lock reaper logs (last 5 min)     │
│  └── FORCE_DEPLOY escape hatch                   │
│      ├── Requires JUSTIFICATION env var           │
│      ├── Logs bypass with justification           │
│      └── Continues deploy                         │
└─────────────────────────────────────────────────┘
```

**Data flow:**
- Entry: `npm run deploy:checklist` or called by `deploy-full-verified.sh`
- Transform: run checks, collect results, aggregate pass/fail
- Exit: exit code 0/1, JSON summary, human-readable report

**Checklist items:**

| # | Check | Phase | Gate |
|---|-------|-------|------|
| 1 | `npm run build` exits 0 | Pre | Block |
| 2 | `npm test` exits 0 | Pre | Block |
| 3 | `npm run type-check` exits 0 | Pre | Block |
| 4 | `npm run lint` exits 0 | Pre | Block |
| 5 | `stryker-baseline.json` exists | Pre | Block |
| 6 | Circuit breaker D1 migration exists | Pre | Warn |
| 7 | Lock reaper config valid | Pre | Warn |
| 8 | `/api/health` returns 200 | Post | Block |
| 9 | Health `status` != `"unhealthy"` | Post | Block |
| 10 | `/api/version` `shortSha` matches | Post | Block |
| 11 | Circuit state `"closed"` (all services) | Post | Warn |
| 12 | Audit trail health 200 | Post | Warn |
| 13 | No stale locks in last 5 min | Post | Warn |

## Related Code Files

| File | Action | Notes |
|------|--------|-------|
| `scripts/deploy-checklist-verify.sh` | Create | Main checklist script |
| `scripts/deploy-full-verified.sh` | Modify | Add checklist call before deploy-with-sha.sh |
| `package.json` | Modify | Add `deploy:checklist` script |
| `scripts/pre-deploy-gate.mjs` | Read-only | Existing gate, may integrate |
| `scripts/post-deploy-smoke.mjs` | Read-only | Existing smoke test |
| `.claude/rules/sophia-deploy-verify.md` | Read-only | Verification sequence reference |

## Implementation Steps

1. Create `scripts/deploy-checklist-verify.sh` with pre-deploy and post-deploy phases
2. Implement pre-deploy checks: build, test, type-check, lint
3. Implement stryker baseline existence check
4. Implement circuit breaker D1 migration check
5. Implement lock reaper config validation
6. Implement post-deploy health check: curl `/api/health`, parse JSON
7. Implement version SHA match check
8. Implement circuit state check (aggregate across all services)
9. Implement audit trail health check
10. Implement stale lock check (parse reaper logs)
11. Add `FORCE_DEPLOY=1` + `JUSTIFICATION` escape hatch
12. Add structured JSON output + human-readable summary
13. Modify `deploy-full-verified.sh` to call checklist before `deploy-with-sha.sh`
14. Add `deploy:checklist` script to `package.json`
15. Test: run checklist locally, verify output
16. Verify: `npm run deploy:checklist` exits 0

## Todo List

- [ ] Create `scripts/deploy-checklist-verify.sh` — main script
- [ ] Implement pre-deploy checks (build, test, type-check, lint)
- [ ] Implement stryker baseline check
- [ ] Implement circuit breaker D1 migration check
- [ ] Implement lock reaper config validation
- [ ] Implement post-deploy health check
- [ ] Implement version SHA match check
- [ ] Implement circuit state check (aggregate)
- [ ] Implement audit trail health check
- [ ] Implement stale lock check
- [ ] Add `FORCE_DEPLOY` escape hatch with justification logging
- [ ] Add structured JSON output
- [ ] Add human-readable summary
- [ ] Modify `deploy-full-verified.sh` to call checklist
- [ ] Add `deploy:checklist` script to `package.json`
- [ ] Test checklist locally
- [ ] Run `npm test` — all pass

## Success Criteria

- `npm run deploy:checklist` runs all pre-deploy checks and exits 0
- Post-deploy checks verify live endpoints
- `FORCE_DEPLOY=1 JUSTIFICATION="..."` bypasses checklist with logged justification
- Checklist output is structured JSON + human-readable
- Exit code 1 on any failure (unless FORCE_DEPLOY)
- Checklist integrates with `deploy-full-verified.sh` pipeline
- All existing deploy verification still works

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Checklist blocks hotfixes | Medium | High | `FORCE_DEPLOY=1` escape hatch |
| Post-deploy checks fail on cold start | Low | Medium | Retry logic with 10s delay |
| Stale lock check requires log access | Medium | Low | Graceful skip if logs unavailable |
| Checklist adds deploy time | Low | Low | Target < 30s pre-deploy, < 60s post-deploy |
| Checklist script incompatible with M1 | Low | Medium | Use only standard bash + curl |

## Security Considerations

- `JUSTIFICATION` env var logged for audit trail
- Checklist does not expose secrets or API keys
- Post-deploy health checks use existing authenticated endpoints
- `FORCE_DEPLOY` escape hatch is logged and auditable
- Checklist script does not modify any state (read-only checks)

## Next Steps

- Depends on: Phase 03 (health/version endpoints), Phase 01 (circuit breaker), Phase 02 (Stryker), Phase 05 (lock reaper)
- Blocks: nothing (terminal phase)
- Follow-up: Integrate checklist with GitHub Actions (when re-enabled), add Slack notification on failure
