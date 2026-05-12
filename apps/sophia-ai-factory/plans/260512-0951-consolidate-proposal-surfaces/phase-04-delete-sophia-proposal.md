# Phase 04 — Delete `apps/sophia-proposal/` + Verify Production GREEN

**Status:** completed | **Completed:** 2026-05-12

## Context Links

- [plan.md](./plan.md)
- Predecessor: Phase 03 ports merged (or Phase 03 skipped because audit PORT LIST was empty)
- Production: https://sophia.agencyos.network (CF-direct via `npm run deploy:full`)

## Overview

- **Priority:** P2
- **Status:** completed
- **Effort:** ~1h (15m delete + 15m local verify + 15m deploy + 15m prod verify)
- **Why:** Irreversible-by-revert deletion of ~10,459 LOC, 458 files. Must follow GREEN PRODUCTION RULE strictly.

## Key Insights

- sophia-proposal's `wrangler.toml` (`name = "sophia-proposal"`) is orphan; deleting it cannot break the active deploy (root `wrangler.jsonc` points to canonical).
- sophia-proposal's `deploy:cloudflare` package.json script (`wrangler pages deploy ...`) is not invoked by any automation — safe to delete.
- Rollback path = `git revert <phase-04-commit>` (single commit, even if large).
- FREE100 partner traffic only hits canonical `apps/sophia-ai-factory/` routes — no FREE100 dependency on sophia-proposal endpoints (pre-verified ZERO live deploy at any sophia-proposal worker name).

## Requirements

### Functional
- `apps/sophia-proposal/` directory fully removed from working tree and git history (via `git rm -rf`).
- No residual references in canonical code (compiler will catch most).
- Production https://sophia.agencyos.network unchanged behavior; SHA at `/api/version` matches new HEAD.

### Non-Functional
- Build passes from `apps/sophia-ai-factory/`.
- Tests ≥ 4078 passing.
- Deploy SHA-match within 5 minutes of `wrangler deploy` completion.

## Architecture

No architecture change. Pure subtraction. Repo size shrinks by ~458 files.

## Related Code Files

### Delete
- `apps/sophia-proposal/` (entire directory)

### Modify
- Possibly `pnpm-lock.yaml` / `package-lock.json` at repo root if workspaces include `apps/sophia-proposal`. Verify before deleting.
- `pnpm-workspace.yaml` or root `package.json` `workspaces` field — remove `apps/sophia-proposal` glob/entry if present.

## Implementation Steps

1. **Pre-flight grep** — fresh sweep for any remaining references (must be 0):
   ```bash
   cd /Users/macbook/projects/sophia-ai-factory
   grep -rn "apps/sophia-proposal\|@sophia/proposal" \
     apps/sophia-ai-factory \
     docs scripts .github wrangler.jsonc package.json pnpm-workspace.yaml 2>/dev/null \
     | grep -v "/sophia-proposal/" | grep -v "node_modules"
   # Expected: 0 matches (the only 2 historical refs in src/forest/components/proposals/ and src/seed/types/raas.ts were stale comments — re-check they're gone or harmless)
   ```
2. **Check workspaces** — root `package.json` likely lists workspaces:
   ```bash
   jq '.workspaces' package.json 2>/dev/null
   cat pnpm-workspace.yaml 2>/dev/null
   ```
   If `apps/sophia-proposal` is enumerated, remove its entry FIRST in same commit.
3. **Delete the directory**:
   ```bash
   git rm -rf apps/sophia-proposal/
   ```
4. **Local build**:
   ```bash
   cd apps/sophia-ai-factory
   npm run build
   ```
   Must exit 0. If any error like "module not found: @sophia/raas-sdk", Phase 03 missed a port — STOP, revert, return to Phase 03.
5. **Local tests**:
   ```bash
   npm test -- --run
   ```
   Must pass ≥ 4078. If regressions, debug before deploy.
6. **Commit**:
   ```bash
   git add -A
   git commit -m "chore: remove apps/sophia-proposal (DEPRECATED, merged into sophia-ai-factory)

   - Self-declared DEPRECATED in apps/sophia-proposal/CLAUDE.md
   - Original merge commit 045474da (2026-03-27) consolidated features into apps/sophia-ai-factory
   - Real gaps ported in prior commit(s) (Phase 03 of consolidation plan)
   - 458 files removed, ~10,459 LOC reduction
   - Rollback: git revert HEAD"
   ```
7. **Deploy** (per CF-direct doctrine):
   ```bash
   cd apps/sophia-ai-factory
   npm run deploy:full
   ```
8. **Verify GREEN production** (mandatory; per binh-phap-cicd.md Rule #0):
   ```bash
   LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
   echo "Local HEAD: $LOCAL_SHA"

   # SHA match (mandatory)
   PROD_SHA=$(curl -s https://sophia.agencyos.network/api/version | jq -r .shortSha 2>/dev/null)
   echo "Prod SHA:   $PROD_SHA"
   [ "$LOCAL_SHA" = "$PROD_SHA" ] && echo "✅ SHA MATCH" || { echo "❌ SHA mismatch — deploy did not propagate"; exit 1; }

   # HTTP 200 sanity
   curl -sI https://sophia.agencyos.network | head -3

   # Dashboard sanity (FREE100 critical path)
   curl -sI https://sophia.agencyos.network/dashboard/proposals | head -3
   ```
9. **Push to remote**:
   ```bash
   git push origin main
   ```
10. **Post-push verification**:
    ```bash
    curl -s https://sophia.agencyos.network/api/version | jq .
    curl -sI https://sophia.agencyos.network/dashboard/proposals
    ```
    Both must succeed. Document outputs in Phase 05's docs update.

## Todo List

- [x] Pre-flight grep returns 0 hits
- [x] Remove workspace entry if present
- [x] `git rm -rf apps/sophia-proposal/`
- [x] `npm run build` → exit 0
- [x] `npm test -- --run` → ≥ 4078 pass
- [x] Commit with rollback note → 2d54bbe9 shipped on main
- [x] `npm run deploy:full` (CF-direct) — deployed & SHA-verified
- [x] SHA match at `/api/version` ✅ 2d54bbe9 matches production
- [x] HTTP 200 at root + `/dashboard/proposals` ✅
- [x] `git push origin main` ✅
- [x] Post-push re-verify SHA + endpoints ✅ LIVE

## Success Criteria

- `ls apps/sophia-proposal` → "no such file or directory".
- Build green locally.
- Tests green locally (≥ 4078).
- Production SHA at `/api/version` matches local HEAD short SHA.
- HTTP 200 at `/` and `/dashboard/proposals`.
- No new errors in Sentry within 15 minutes post-deploy (manual check).

## Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| Hidden import surfaces at build | Med | Step 4 build catches it; revert commit and patch in Phase 03 |
| Wrangler workspace globs broke | Low | Step 2 removes entry; root wrangler.jsonc explicit path is safe |
| Deploy fails mid-way | Low | `npm run deploy:full` is canonical; if fails, fix and retry; do NOT push commit until SHA match |
| FREE100 dashboard regression | Med | Step 8 curls dashboard route; manual smoke on Cmd-click before push |
| Sentry alert spike | Low | Post-deploy 15-min Sentry watch; revert via `git revert` if spike attributable |
| User cron jobs to dead routes | Very Low | Verified zero live deploy at any sophia-proposal worker name in Phase 02 |

## Security Considerations

- Verify no secrets exist in `apps/sophia-proposal/` git history that would persist post-deletion. (Git rm preserves history; if secrets present, separate "BFG repo cleaner" task required — flag to user, do NOT block this phase.)
- After delete, ensure no leaked surface area in `wrangler.toml.bak` (canonical has one — left for archaeology, not deployed).

## Next Steps

- → Phase 05 (docs sync). Can start same day if deploy verified GREEN.
- If rollback needed: `git revert HEAD` + `npm run deploy:full` → re-verify SHA match.
