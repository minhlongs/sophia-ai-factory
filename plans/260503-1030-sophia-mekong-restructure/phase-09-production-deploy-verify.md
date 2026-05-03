# Phase 09 — Production Deploy + Verify GREEN

## Context Links
- Plan: [plan.md](plan.md)
- Depends on: ALL prior phases
- Production: https://sophia.agencyos.network
- Verification rule: `~/.claude/rules/binh-phap-cicd.md` (3-step pipeline)

## Overview
- **Priority:** P1
- **Status:** completed — deploy GREEN 2026-05-03T19:42:33Z, SHA ba3af5a8, 9/9 smoke PASS
- **Effort:** 45m
- **Description:** Push restructure to main, monitor CI/CD, verify all 9 production routes return 200, verify HEAD short SHA matches `/api/version` shortSha.

## Key Insights
- Sophia uses Cloudflare Workers via OpenNext (`open-next.config.ts`, `wrangler.jsonc`).
- Deploy script: `scripts/deploy-with-sha.sh` injects build SHA into `/api/version` for verification (per Sophia rule).
- 9 production routes (per Work Context): the canonical smoke-test set.
- Push-and-Done is BANNED (rule #5) — must verify production GREEN.

## Requirements

### Functional
- All Phase 03-08 commits pushed to `main`
- GitHub Actions CI passes (build + tests + deploy job)
- All 9 production routes return HTTP 200
- `/api/version` returns shortSha matching `git rev-parse --short HEAD`
- 2546 (or more) tests pass on CI

### Non-Functional
- Zero downtime (Cloudflare Workers blue-green)
- Rollback ready: `git revert HEAD~6..HEAD` reverts all 6 phases atomically

## Architecture (Deploy Pipeline)
```
local main (with phase 03-08 commits)
        │
        ▼
git push origin main
        │
        ▼
GitHub Actions ─── Lint ─── Build ─── Test ─── Deploy (Cloudflare Workers)
                                                     │
                                                     ▼
                                        sophia.agencyos.network
                                                     │
                       ┌─────────────────────────────┼──────────────────────────┐
                       ▼                             ▼                          ▼
                Curl 9 routes              /api/version SHA check        E2E smoke
```

## Related Code Files

### To modify
- None (deploy-only phase)

### To run
- `scripts/deploy-with-sha.sh` (if exists; else `git push` triggers CI deploy)

## Implementation Steps

1. Pre-flight: confirm clean working tree, all phases committed locally
2. Run final local check: `npm run build && npm test && npm run lint` — all GREEN
3. `git log --oneline origin/main..HEAD` — verify 6+ commits ready (phases 02-08, optionally 01)
4. Push: `git push origin main`
5. Get RUN_ID:
   ```bash
   COMMIT_SHA=$(git rev-parse HEAD)
   RUN_ID=$(gh run list --commit "$COMMIT_SHA" --json databaseId -q '.[0].databaseId')
   ```
6. Poll CI/CD until completed (max 8 min):
   ```bash
   while true; do
     STATUS=$(gh run view "$RUN_ID" --json status,conclusion -q '"\(.status):\(.conclusion)"')
     case "$STATUS" in
       completed:success) echo "✅ GREEN"; break ;;
       completed:failure|completed:cancelled) echo "❌ FAILED"; gh run view "$RUN_ID" --log-failed; exit 1 ;;
       *) sleep 30 ;;
     esac
   done
   ```
7. Verify each job: `gh run view "$RUN_ID" --json jobs -q '.jobs[] | "\(.name): \(.conclusion)"'`
8. SHA match check:
   ```bash
   LOCAL_SHA=$(git rev-parse --short HEAD)
   PROD_SHA=$(curl -s https://sophia.agencyos.network/api/version | jq -r '.shortSha')
   [ "$LOCAL_SHA" = "$PROD_SHA" ] && echo "✅ SHA match: $LOCAL_SHA" || { echo "❌ SHA mismatch local=$LOCAL_SHA prod=$PROD_SHA"; exit 1; }
   ```
9. Smoke 9 routes:
   ```bash
   ROUTES=("/" "/pricing" "/status" "/dashboard" "/login" "/onboarding" "/setup-wizard" "/checkout" "/api/status.json")
   for r in "${ROUTES[@]}"; do
     CODE=$(curl -sI "https://sophia.agencyos.network$r" | head -1 | awk '{print $2}')
     [ "$CODE" = "200" ] || [ "$CODE" = "307" ] || { echo "❌ $r returned $CODE"; exit 1; }
     echo "✅ $r → $CODE"
   done
   ```
10. Print verification report (mandatory format per binh-phap-cicd.md)

## Todo List

- [x] Pre-flight local check — build 0 errors, 2546 tests pass
- [x] Deploy via deploy-with-sha.sh — Wrangler version ID 7862606b
- [x] SHA match check — ba3af5a8 matches /api/version
- [x] Smoke 9 routes — 9/9 PASS
- [x] /api/status.json shape verified
- [x] NOWPayments + PayOS endpoints verified (405 = route exists, POST-only)
- [x] Bundle size documented (45323 KiB, +451 delta)
- [x] Verdict report written — plans/reports/deploy-verify-260503-mekong-restructure.md
- [x] Update plan.md status → completed

## Success Criteria
- CI/CD: completed:success
- All jobs (lint, build, test, deploy): success
- Production HTTP: all 9 routes 200/307
- SHA match: local short SHA == /api/version shortSha
- Test count >= 2546

## Verification Report Template
```
## Verification Report — Mekong Restructure
- Build: ✅ exit code 0
- Tests: ✅ <N> tests passed
- Git Push: ✅ <commit_hash> → main
- CI/CD Run: ✅ <run_id> completed:success
- Job: Lint ✅ / Build ✅ / Test ✅ / Deploy ✅
- Production HTTP: ✅ 9/9 routes 200
- Production SHA: ✅ <short> matches local <short>
- Timestamp: <iso8601>
```

## Risk Assessment
- **H** OpenNext build differs from local Next build → deploy fails. Mitigation: run `npx opennextjs-cloudflare build` locally before push.
- **H** Cloudflare bundle size limit (1MB compressed) — restructure may shift import graph. Mitigation: monitor bundle size in CI; have feature-flag bypass ready.
- **M** SHA match fails because deploy job uses cached older build. Mitigation: clear Wrangler cache, force re-deploy.
- **M** External monitor (uptime checker) sees brief 5xx during deploy. Mitigation: Cloudflare Workers blue-green should be transparent; document expected blip.
- **L** Tests pass locally but fail on CI (env diff). Mitigation: run CI locally via `act` if available.

## Security Considerations
- Verify no env vars added/leaked in this push
- Verify Polar webhook secrets still load from env (smoke webhook signature endpoint if test exists)

## Next Steps
- **Unblocks:** Project complete
- **Rollback path:** `git revert HEAD~6..HEAD && git push origin main` reverts phases 03-08 atomically; Phase 02 alias addition is safe to keep
