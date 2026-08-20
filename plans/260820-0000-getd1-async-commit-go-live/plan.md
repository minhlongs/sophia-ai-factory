# Plan: getD1() async migration commit + go-live

**Codename**: GETD1-AWAIT
**Target**: 2026-08-20
**Status**: ✅ Complete
**Priority**: P0 (blocks production deploy)

## Overview

Working tree holds an uncommitted, cross-file correctness fix plus 10 untracked
Phase 8 artifacts. Deploy is blocked until the tree is clean. This plan splits
the work into two conventional commits, verifies zero regression, and ships.

## Phases

### Phase 1: Commit getD1() async migration

**File Ownership**
- `apps/sophia-ai-factory/next.config.ts`
- `apps/sophia-ai-factory/src/app/api/setup/save/route.ts`
- `apps/sophia-ai-factory/src/app/actions/auth.ts`
- `apps/sophia-ai-factory/src/app/actions/schedule.ts`
- 380+ files with `getD1()` → `await getD1()`

**Steps**
1. `git add` all tracked modified files (excluding untracked).
2. Conventional commit: `fix(db): await getD1() — async D1 binding is a Promise, not D1Database`.
3. Verify `git diff --cached --numstat` matches the working-tree diff.

**Acceptance**
- Commit exists; working tree has zero tracked modifications.
- Commit message names the root cause, not the symptom.

### Phase 2: Commit Phase 8 artifacts

**File Ownership**
- `docs/ops/*` (4 files)
- `docs/performance/PERF_BASELINE_2027.md`
- `scripts/perf/bundle-analyzer.ts`
- `src/forest/middleware/__tests__/admin-rate-limit.test.ts`
- `src/seed/db/node-sqlite-d1.ts`
- `tests/e2e/fixtures/flywheel-helpers.ts`
- `tests/perf/load-baseline.spec.ts`

**Steps**
1. `git add` the 10 untracked files.
2. Conventional commit: `docs(phase-8): ship ops runbook, perf baseline, and test fixtures`.

**Acceptance**
- All 10 files committed; zero untracked files remain.

### Phase 3: Verify zero regression

**Steps**
1. `npm test` → 6994 passed, 0 failed.
2. `npm run build` → 0 *new* errors vs baseline of 16.
3. `npm run lint` → no new violations.

**Acceptance**
- Test count and build error count unchanged from baseline.

### Phase 4: Deploy + verify

**Steps**
1. `git push origin main`
2. `npm run deploy:full`
3. SHA match, `/api/health` 200, `/login` 200, `/vi/login` 200.

**Acceptance**
- Deploy green per `sophia-deploy-verify.md`.

## Success Criteria

1. Two conventional commits on main.
2. `npm test` 0 failures; build error count ≤ 16 (baseline).
3. Production SHA matches local HEAD.
4. Protected flows untouched.