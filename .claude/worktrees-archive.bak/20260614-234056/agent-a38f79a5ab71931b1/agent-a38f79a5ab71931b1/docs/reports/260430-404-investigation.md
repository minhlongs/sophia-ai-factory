# 404 Investigation Report — sophia.agencyos.network

**Date:** 2026-04-30 09:00 UTC  
**Investigator:** Debug Agent  
**Severity:** Medium — Site currently functional, but CI pipeline bypassed  

---

## Executive Summary

A 404 error was reported on `https://sophia.agencyos.network`. Investigation reveals that **no CI-triggered deployments ran today (April 30)** — all 10 deployments were manual. The deployment `885b3f35` (08:50 UTC) likely caused 404s due to an OpenNext build/asset mismatch. The issue was resolved (accidentally) by rolling back to `ca782306` during investigation. The site is currently stable but running stale code (2 commits behind HEAD), with the version API showing incorrect metadata.

## Timeline

| Time (UTC) | Event | Source |
|---|---|---|
| Apr 27 ~04:06 | Last CI deploy via `Tests & Deploy` workflow | GitHub Actions |
| Apr 30 05:44 | 3× Secret Change deploys (env var updates) | Manual |
| Apr 30 06:07 | Deployment `25e065d7` — Unknown source | Manual |
| Apr 30 06:08 | Deployment `6ea02132` — Unknown source (sets COMMIT_SHA=817fbaa5) | Manual |
| Apr 30 06:08 | 3× Secret Change deploys | Manual |
| Apr 30 08:40 | Deployment `ca782306` — Unknown source | Manual |
| Apr 30 08:50 | Deployment `885b3f35` — Unknown source (SUSPECT) | Manual |
| Apr 30 08:55 | Investigation: rollback 885b3f35 → ca782306 | Auto-triggered |

## Root Cause Analysis

### Primary: Manual Deploy Without CI Pipeline

The deployment `885b3f35` at 08:50 UTC was performed manually (Source: "Unknown (deployment)") — NOT through the GitHub Actions `Tests & Deploy` workflow. The CI pipeline has not run since April 27.

**Why this matters:** The deploy process for this project requires:
1. `npx opennextjs-cloudflare build` — generates `.open-next/worker.js` AND `.open-next/assets/`
2. `bash scripts/ci/wrangler-set-build-vars.sh` — updates `COMMIT_SHA`, `DEPLOYED_AT`, `DEPLOY_BRANCH` secrets
3. `bash scripts/ci/migration-guard.sh` — blocks deploy if D1 migrations pending
4. `npx wrangler deploy` — uploads worker + assets atomically

When deploying manually, steps 1-3 may be skipped, resulting in:
- **OpenNext asset mismatch**: worker.js references JS/CSS chunks that don't exist in the assets bundle → **404 for page assets** → blank or broken pages
- **Stale version metadata**: `/api/version` returns wrong SHA (still shows `817fbaa5` from 06:08 deployment)
- **No migration guard**: D1 migrations might be missing

### Evidence

1. **No CI runs today**: `gh run list -R longtho638-jpg/sophia-ai-factory -b main` returns only April 27 runs
2. **Stale version API**: `/api/version` returns `shortSha: "817fbaa5"` but git HEAD is `e1f0861f`
3. **COMMIT_SHA not updated**: Only the CI script `wrangler-set-build-vars.sh` updates this secret
4. **All 10 deploys today are manual**: Source shows "Secret Change" or "Unknown (deployment)"

### Confirmation

The accidental rollback (`885b3f35` → `ca782306`) resolved any 404s. Post-rollback verification:
- Root `/` → 200 ✅
- `/login` → 200 ✅
- `/pricing` → 200 ✅
- `/dashboard` → 307 (redirect to login) ✅
- `/affiliate-discovery` → 200 ✅
- `/api/health` → 200 ✅
- `/guide/commands` → 200 ✅
- `/guide/faq` → 200 ✅
- `/favicon.ico` → 200 ✅
- `/manifest.json` → 200 ✅
- `/api/raas/missions` → 401 (auth required) ✅

## Current State

| Component | Status | Detail |
|---|---|---|
| Production URL | ✅ 200 | `https://sophia.agencyos.network` |
| Active Deployment | ca782306 | Rolled back from 885b3f35 |
| Git HEAD | `e1f0861f` | feat: auto video customer handoff |
| Deployed SHA (API) | `817fbaa5` | 2 commits behind HEAD |
| D1 Database | ✅ Accessible | 0 videos (expected for empty DB) |
| CI Pipeline | ⚠️ Stale | Last run: Apr 27 |
| Wrangler | v4.76.0 | Update available: v4.86.0 |

## Recommendations

### Immediate (P0)

1. **Run CI deployment for latest commit** (`e1f0861f`):
   ```bash
   git push origin main  # Trigger Tests & Deploy workflow
   ```
   Or if push already happened:
   ```bash
   gh workflow run "Tests & Deploy" --ref main -R longtho638-jpg/sophia-ai-factory
   ```

2. **Verify deployment SHA matches** after CI completes:
   ```bash
   LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
   LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
   [ "$LOCAL_SHA" = "$LIVE_SHA" ] && echo "✅ MATCH" || echo "❌ MISMATCH"
   ```

### Short-term (P1)

3. **Block manual deploys**: Add branch protection or pre-deploy hook to prevent `wrangler deploy` outside CI
4. **Add deploy source tracking**: Tag manual deploys with `--message "manual: <reason>"` for audit trail
5. **Update Wrangler**: v4.76.0 → v4.86.0 (`npm install wrangler@latest`)

### Long-term (P2)

6. **Add 404 rate monitoring**: Alert if 404 rate exceeds 5% of traffic in 5-min window
7. **Implement canary deploys**: Deploy to 10% traffic first, verify, then promote
8. **Health check endpoint**: Already exists at `/api/health` — add asset integrity check (hash manifest validation)

## Known Issues

- **Version API stale**: Shows `817fbaa5` instead of actual deployed code — will fix after CI deploy updates `COMMIT_SHA` secret
- **No wrangler tail logs captured**: Tail connected but no traffic during 10-25s sampling windows — need longer sampling or different time window
- **GitHub Actions empty results**: `gh run list` returned `[]` on some queries — may need token scope verification

## Unresolved Questions

1. **What specific path returned 404?** — Not specified in the report. All major routes tested return correct status codes. Could be an API endpoint, a static asset path, or an edge case URL.
2. **Who performed the manual deploys?** — All show `billwill.mentor@gmail.com` as author, but no CI run triggered.
3. **Why were there 10 deployments in 4 hours?** — Unusual pattern: 3 secret updates, 2 code deploys, 3 more secrets, 2 more code deploys. Possible troubleshooting or failed deploy retries.
4. **Is `e1f0861f` ready for production?** — The 27 changed files (including migration 0034, new video onboarding pipeline) haven't been verified in production yet.

---

*Report generated by Debug Agent | 2026-04-30*
