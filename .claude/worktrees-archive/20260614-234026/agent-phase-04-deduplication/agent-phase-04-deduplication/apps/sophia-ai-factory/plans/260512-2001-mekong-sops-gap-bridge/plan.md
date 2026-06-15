---
title: "Mekong SOP Gap Bridge — Sophia AI Factory"
description: "Port mekong-cli SOPs, 5 CI gates, layer boundary enforcement into sophia (CF-direct stack)"
status: completed
priority: P2
effort: 10-13h (actual ~10-11h)
branch: main
tags: [sops, ci-gates, layer-architecture, husky, eslint]
created: 2026-05-12
completed: 2026-05-12
---

# Plan: Mekong SOP Gap Bridge

## Context

- Research baseline: `plans/reports/researcher-260512-2001-mekong-architecture-baseline.md`
- Sophia state: `plans/reports/researcher-260512-2001-sophia-current-state.md`
- Phase 4 PEV port: **DEFERRED per YAGNI** — sophia uses Inngest event-driven orchestration (different paradigm)

## Goal

Close 3 gaps to bring sophia from 78/100 → 90+/100 vs mekong standards:

1. **GAP-1 SOP docs:** No unified `dev-sops.md` (scattered across 5 files)
2. **GAP-2 CI gates:** No pre-commit/pre-push enforcement (CF-direct doctrine — no GHA)
3. **GAP-3 Layer violations:** 5 known `seed/auth/* → forest/*` imports + no ESLint enforcement

## Stack Constraints

- Package manager: **npm** (not pnpm — verified in `package.json`)
- CI: **NO GitHub Actions** (disabled by design 2026-05-03)
- Deploy: CF-direct (`npm run deploy:full` + SHA verify)
- App root: `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory`

## Phases

| # | File | Title | Effort | Status |
|---|---|---|---|---|
| 01 | [phase-01-sop-docs.md](./phase-01-sop-docs.md) | Create unified `docs/dev-sops.md` (10 sections) | M (3-4h) | pending |
| 02 | [phase-02-ci-gates.md](./phase-02-ci-gates.md) | Wire 5 gates via npm + husky | M (3-4h) | pending |
| 03 | [phase-03-layer-fix.md](./phase-03-layer-fix.md) | Fix 5 seed→forest + ESLint rule + boundary docs | M (4-5h) | pending |

Total budget: **10-13h**. Each phase ships independently with own commit + SHA-verify.

## Sequencing Recommendation

**Sequential: 1 → 2 → 3** (NOT parallel)

- Phase 1 SOP docs documents the gates that Phase 2 implements (forward reference)
- Phase 2 husky pre-commit catches Phase 3 layer violations during fix process
- Phase 3 needs Phase 2 ESLint rule scaffolding (eslint.config.mjs edits)

Parallel-safe only if Phase 1 + 2 split (docs vs scripts), but Phase 3 MUST wait for Phase 2.

## Key Dependencies

- Phase 2 needs `husky` + `lint-staged` packages (`npm install -D`)
- Phase 3 needs Phase 2's ESLint config edits as starting point
- All phases require build + test passing before merge (use CF-direct verify per `sophia-deploy-verify.md`)

## Success Criteria (whole plan)

- [ ] `docs/dev-sops.md` exists with 10 SOP sections
- [ ] `npm run ci` runs all 5 gates sequentially with exit 0
- [ ] `.husky/pre-commit` + `.husky/pre-push` installed and execute
- [ ] `grep -rn "from ['\"]@/forest" src/seed/` returns 0 results
- [ ] ESLint flags any new `@/forest/*` or `@/tree/*` import in `src/seed/**`
- [ ] All 1398+ existing tests still pass after Phase 3 refactor
- [ ] Production SHA matches local SHA after each phase deploy

## Risks (cross-phase)

- Phase 3 tier enforcement refactor could break protected payment/auth flows → must run full test suite + manual smoke before deploy
- Husky may conflict with monorepo root if installed wrong scope → restrict to `apps/sophia-ai-factory`
- ESLint `no-restricted-imports` may flag test fixtures → use overrides for `**/*.test.ts`
