# Phase 04 — Move tree/ Layer (Single-Tenant CEO Ops)

## Context Links
- Plan: [plan.md](plan.md)
- Depends on: [phase-03-move-seed-layer.md](phase-03-move-seed-layer.md)
- Scout report: `reports/scout-260503-dependency-graph.md`

## Overview
- **Priority:** P1
- **Status:** **COMPLETE** (PR #26, commit f4a5009b, merged main 2026-05-03)
- **Effort:** 90m
- **Description:** `git mv` all tree-classified files into `src/tree/`. Reuse codemod from Phase 03. Atomic commit.

## Key Insights
- tree/ may import seed/ (allowed: down direction). If scout shows tree → forest/land, those are violations — fix BEFORE moving.
- Setup wizard pages (`src/app/setup-wizard/`) move bodily including `page.tsx` and route segments.
- Admin dashboard route under `[locale]/dashboard/admin/` is server-side rendered — moving the file relocates the route URL? **NO** — only when renaming under `app/`. Moving SOURCE files of components used by routes is safe; moving ROUTE files (`page.tsx`, `route.ts`) changes URLs.
- **CRITICAL:** route segment files (`page.tsx`, `layout.tsx`, `route.ts` under `src/app/`) MUST stay in their current `app/` location to preserve URLs. Only their imports get rewritten. Document explicitly per file in scout report.
- File count target: ~150-300 files.

## Requirements

### Functional
- All tree NON-ROUTE files moved to `src/tree/<original-relative-path>`
- ROUTE files (page.tsx, layout.tsx, route.ts under src/app/) remain in place; ONLY their imports rewritten
- All cross-references updated via codemod
- Build/test/lint pass

### Non-Functional
- Atomic single commit
- Zero URL changes — verified by route enumeration before/after

## Architecture
```
src/
├── seed/...                    (from Phase 03)
├── tree/                        (NEW)
│   ├── lib/handover/...
│   ├── lib/telegram/...
│   ├── components/setup-wizard/...   (moved IF non-route)
│   └── components/dashboard/admin/...
└── app/
    ├── setup-wizard/page.tsx          (STAYS — route file)
    └── [locale]/dashboard/admin/page.tsx  (STAYS — route file)
```

## Related Code Files

### To move (via `git mv`)
- `src/lib/handover/**/*` → `src/tree/lib/handover/**/*`
- `src/lib/telegram/**/*` → `src/tree/lib/telegram/**/*`
- Agent persona configs (path TBD from scout)
- Setup-wizard internals NOT route files

### Stays in place (route files)
- `src/app/setup-wizard/page.tsx`
- `src/app/setup-wizard/**/page.tsx`, `layout.tsx`, `route.ts`
- `src/app/[locale]/dashboard/admin/**/page.tsx`, etc.

### To modify (codemod)
- All importers — rewrite to `@/tree/...`
- Route files — rewrite their imports to `@/tree/...`

## Implementation Steps

1. Read scout report `tree` bucket; SPLIT into `tree-move.txt` (non-route) and `tree-routes-stay.txt`
2. Generate move map from `tree-move.txt`
3. Snapshot current routes: `find src/app -name 'page.tsx' -o -name 'route.ts' | sort > /tmp/routes-before.txt`
4. Execute `git mv` batch
5. Run codemod with move map
6. Verify routes unchanged: `find src/app -name 'page.tsx' -o -name 'route.ts' | sort > /tmp/routes-after.txt && diff /tmp/routes-before.txt /tmp/routes-after.txt` MUST be empty
7. Clear caches
8. Build + test + lint
9. Smoke test: `npm run dev` → curl `/setup-wizard` and `/dashboard/admin` → 200
10. Commit: `refactor(tree): mekong layer 2 — single-tenant CEO ops moved to src/tree/`

## Todo List

- [x] Split tree files into move/stay buckets
- [x] Snapshot routes (358 files)
- [x] Execute moves (168 files via git mv)
- [x] Run codemod (382 imports rewritten in 229 files + manual fixes for vi.mock/relative imports)
- [x] Verify routes unchanged (diff = empty)
- [x] Build/test/lint pass (0 errors, 2546/0 pass)
- [x] Smoke test routes (N/A — no dev server, route diff confirmed)
- [x] Commit (f4a5009b, PR #26)

## Success Criteria
- `diff routes-before.txt routes-after.txt` empty
- Build/test/lint green
- Dev server smokes pass on `/setup-wizard`, `/dashboard/admin`

## Risk Assessment
- **H** Accidentally moving a route file changes URL → 404 on production. Mitigation: route snapshot diff is GATING.
- **M** Codemod doesn't update route file's own imports (since route file didn't move). Mitigation: codemod rewrites by SPECIFIER, not by file location — works regardless.
- **L** Telegram bot startup imports stale paths at runtime (lazy `require`). Mitigation: grep for `require\(['"]\.\.\/` patterns in scout.

## Security Considerations
- None new (no auth/secrets touched).

## Next Steps
- **Unblocks:** Phase 05 (move forest/)
