# Phase 02 — Audit `apps/sophia-proposal/` (Read-Only)

**Status:** completed | **Completed:** 2026-05-12

## Context Links

- [plan.md](./plan.md)
- Target: `apps/sophia-proposal/` (458 files, ~10,459 LOC, self-declared DEPRECATED in `apps/sophia-proposal/CLAUDE.md`)
- Canonical: `apps/sophia-ai-factory/src/` (i18n routing under `[locale]/`)
- Merge commit: `045474da` (2026-03-27) "feat: merge sophia-proposal into sophia-ai-factory — unified platform"

## Overview

- **Priority:** P2
- **Status:** completed
- **Effort:** 1-2h
- **Why now:** Phase 04 deletion is irreversible-by-revert (large diff). Gates on a written gap report so we don't lose un-ported value.

## Key Insights from Pre-Plan Recon

Pre-plan recon confirmed:
- sophia-proposal uses flat `app/` (no `[locale]`); canonical uses `src/app/[locale]/`. Routing schemes differ — direct file copy is NOT safe; ports must respect i18n shape in canonical.
- sophia-proposal's `wrangler.toml` (`name = "sophia-proposal"`) is ORPHAN config. Repo-root `wrangler.jsonc` (`name = "sophia-ai-factory"`, `main = apps/sophia-ai-factory/.open-next/worker.js`) is the active deploy.
- Only 2 stale source-comment refs to "sophia-proposal" exist in canonical src/ — both are header attribution, not imports.
- Confirmed gaps from recon (must triage):
  - `app/api/proposals/generate/route.ts` (166 LOC, real implementation) vs canonical STUB (27 LOC).
  - `app/api/proposals/[id]/route.ts` (39 LOC GET/PATCH/DELETE) — canonical has no `[id]` subroute.
  - Routes ONLY in sophia-proposal: `/api/crm`, `/api/feedback`, `/api/onboarding`, `/api/org`, `/api/raas/keys`.
  - `packages/raas-sdk/` — public client SDK; NOT present in canonical.
  - `lib/` subdirs: `ai/claude-proposal-generator`, `ai/quality-check`, `ai/proposal-templates`, `validators/proposal`, `billing/balance-checker`, `raas/resolve-token`, `org/*`, `crm/*`, `surveys/*`, `onboarding/*`, `email/*`, `pdf/*`, `blog/*`.

## Requirements

### Functional
Produce a written audit report at `plans/260512-0951-consolidate-proposal-surfaces/reports/audit-sophia-proposal.md` with sections:
1. **Inventory** — file count, dir map, LOC by area.
2. **Route-by-Route Diff** — every `app/api/**/route.ts` and `app/**/page.tsx` in sophia-proposal classified PORT / SKIP / SUPERSEDED.
3. **Lib Diff** — every `lib/<area>/` classified.
4. **Deploy/Infra Sanity** — confirm orphan `wrangler.toml` + `deploy:cloudflare` script have NOT been invoked recently; confirm no live worker at `sophia-proposal.workers.dev`.
5. **External Consumers** — packages/raas-sdk publish status; any docs/links pointing into sophia-proposal.
6. **Migration Files** — list `migrations/0005-0010` vs canonical; confirm SAFE to drop without applying.
7. **Final Port List** — concrete files to copy/adapt in Phase 03, with target paths in canonical.

### Non-Functional
- READ-ONLY phase. No file mutations in source, no commits, no deploys.

## Architecture

No system change in this phase. Output: one Markdown report.

## Related Code Files

### Read (audit targets)
- `apps/sophia-proposal/app/**`
- `apps/sophia-proposal/lib/**`
- `apps/sophia-proposal/packages/raas-sdk/**`
- `apps/sophia-proposal/migrations/**`
- `apps/sophia-proposal/wrangler.toml`
- `apps/sophia-proposal/package.json` (scripts + deps)
- `apps/sophia-proposal/CLAUDE.md`, `AGENTS.md`, `docs/**`

### Write
- `plans/260512-0951-consolidate-proposal-surfaces/reports/audit-sophia-proposal.md`

## Implementation Steps

1. **Inventory pass** — produce a tree summary:
   ```bash
   find apps/sophia-proposal -type d -not -path "*node_modules*" -not -path "*.next*" | sort
   find apps/sophia-proposal/app -name "route.ts" -o -name "page.tsx" | sort > /tmp/sp-routes.txt
   find apps/sophia-ai-factory/src/app -name "route.ts" -o -name "page.tsx" | sort > /tmp/sf-routes.txt
   ```
2. **Route diff** — for each entry in `/tmp/sp-routes.txt`, classify against canonical:
   - PORT — feature unique to sophia-proposal AND active (e.g., `/api/proposals/generate`).
   - SUPERSEDED — canonical already has richer equivalent (likely all RaaS routes, all dashboard pages — confirm with quick head-of-file diff).
   - SKIP — dead/experimental (e.g., onboarding subflows not used in FREE100 path).
3. **Lib diff** — for each `apps/sophia-proposal/lib/<area>/`:
   - `grep -rn "from .*lib/<area>" apps/sophia-proposal/app apps/sophia-proposal/lib` → if internal-only and the consumer route is SUPERSEDED/SKIP → SKIP.
   - If consumed by a PORT route → PORT (record exact files).
4. **packages/raas-sdk consumer check**:
   ```bash
   cat apps/sophia-proposal/packages/raas-sdk/package.json | head -20
   # capture: name, version, "private", "publishConfig"
   npm view <pkg-name> 2>&1 | head -10  # is it on npm?
   grep -rn "@sophia/raas-sdk\|raas-sdk" apps/sophia-ai-factory docs scripts 2>/dev/null
   ```
   Document: is this SDK reachable from external developers TODAY? Decide re-home location.
5. **Deploy sanity**:
   - `wrangler deployments list --name sophia-proposal` (if `wrangler` available + authed) — if zero deployments OR last deployment older than canonical's deploy doctrine flip (2026-05-03), confirm orphan.
   - `curl -sI https://sophia-proposal.workers.dev` and `curl -sI https://sophia-proposal.PROD_DOMAIN/api/version` — both should fail or 404. Document.
   - `grep -rn "sophia-proposal" .github/ scripts/ apps/sophia-ai-factory/scripts/` — should be 0 (besides stale comments).
6. **Migration check**:
   ```bash
   ls apps/sophia-proposal/migrations/
   # 6 files: 0005-mission-steps, 0006-schema-alignment, 0007-leads-table, 0008-blog-posts, 0009-blog-posts-seo, 0010-health-checks
   ls apps/sophia-ai-factory/migrations/ | grep -E "^00(0[5-9]|10)"
   # canonical has its own 0005-0010 + many more
   ```
   For each sophia-proposal migration, check if canonical D1 (`sophia-raas-db`, shared) already has equivalent table by querying schema (skip if unauthed — note as user-action).
7. **External docs check**:
   ```bash
   grep -rn "apps/sophia-proposal\|sophia-proposal" docs/ apps/sophia-ai-factory/docs/ README.md 2>/dev/null
   ```
8. **Write report** to `plans/260512-0951-consolidate-proposal-surfaces/reports/audit-sophia-proposal.md` with the 7 sections from Requirements. End with a numbered PORT LIST that Phase 03 will execute against.

## Todo List

- [x] Generate inventory + route lists
- [x] Classify every route (PORT / SUPERSEDED / SKIP)
- [x] Classify every lib area
- [x] Verify raas-sdk publish status
- [x] Verify zero live deploy at sophia-proposal worker
- [x] Check migrations alignment
- [x] Grep external docs for stale references
- [x] Write audit report with final PORT LIST → reports/audit-sophia-proposal.md
- [x] Surface 3 open questions (see plan.md) for user

## Success Criteria

- Report file exists at `plans/260512-0951-consolidate-proposal-surfaces/reports/audit-sophia-proposal.md`.
- Every `route.ts` and `page.tsx` in sophia-proposal has a classification.
- PORT LIST is concrete: file paths + target paths in canonical.
- Open questions enumerated for user before Phase 03 starts.
- Zero file mutations in repo (verify `git status` clean except for report).

## Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| Auditor over-ports (YAGNI breach) | Med | Default classification = SKIP unless evidence of active use |
| Missed external SDK consumer | Med | Step 4 npm view + grep; if uncertain, flag as open question, do NOT delete in P04 |
| Migration drift discovered | Low | Step 6; if drift found, raise as separate plan, do NOT proceed with P04 |
| Underestimating audit time | Med | Time-box: 2h max; if not done, deliver partial report + scope reduction |

## Security Considerations

- Audit may surface plaintext secrets in `apps/sophia-proposal/` (env templates, leftover keys). If found, do NOT include verbatim in audit report; reference path only and raise as user-action item.

## Next Steps

- → Phase 03 (port gaps) gated on user approval of PORT LIST.
- If PORT LIST is empty → skip Phase 03, jump directly to Phase 04.
