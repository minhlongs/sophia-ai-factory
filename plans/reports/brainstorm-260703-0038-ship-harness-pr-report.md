# Brainstorm Report: Ship Harness Engineering PR

**Date:** 2026-07-03 | **Project:** Sophia AI Factory | **Status:** ✅ Design Approved

---

## Problem

PR #31 (`feature/harness-engineering`) has been open for 34 days with zero reviews. It adds a complete system health harness (6 health checks, daemon, dashboard UI, Telegram commands) — ~12 genuinely-new files. But the branch is 362 commits behind main, has dead import paths in the daemon, and uses banned `console.log` in production code.

## Scout Findings

- **1 open PR** (`feature/harness-engineering`), 3 unique commits, 362 main commits ahead
- **~12 genuine harness files** (5 API routes, daemon + test, dashboard card, Telegram handler, migration)
- **Rest of diff (~100+ files)** is stale base divergence — already exists on main
- Daemon uses `../../lib/validation/services` (dead path), `console.log` (banned), `process.env.HARNESS_SECRET` (wrong CF Workers pattern)
- API routes use correct `@/seed/db/client`, `@/seed/utils/to-error` imports
- 9 tests claimed passing (need to verify after rebase)
- Migration `0148_harness_tables.sql` doesn't exist on main — genuinely new

## Approach: 3 Phases

### Phase 1: Inventory PR files vs main (~15 min)
- Confirm which files are genuinely unique to the PR
- Skip stale base files (already on main)
- Identify dead imports to fix

### Phase 2: Rebase + fix quality issues (~1 hr)
- Rebase 3 harness commits onto main
- Fix daemon: `console.log` → logger, `../../lib/validation/services` → canonical, `process.env` → `getCloudflareEnv()`
- Add `runtime = 'edge'` exports to routes that lack them
- Fix migration number if 0148 collides with main's current max

### Phase 3: Verify + merge (~30 min)
- `npm run build` → 0 TS errors
- `npm test` → all pass
- `gh pr merge` (squash)
- Delete stale branch

## Files

| Action | File | Notes |
|--------|------|-------|
| Rebase | `src/tree/harness/daemon.ts` | Fix imports, console.log → logger |
| Rebase | `src/tree/harness/__tests__/daemon.test.ts` | Update if imports changed |
| Verify | `src/app/api/v1/harness/*` | 5 routes: confirm runtime exports |
| Verify | `src/tree/telegram/telegram-bot-harness-handlers.ts` | Check import paths |
| Verify | `migrations/0148_harness_tables.sql` | Renumber if collision |
| Merge | PR #31 | Squash merge to main |

## Out of Scope

- New harness features (additional health checks beyond the 6 already implemented)
- Remotion integration (daemon includes it but may not work on CF Workers)
- Rewriting the daemon architecture

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Rebase conflicts on harness code | Low | Medium | Only 12 genuine files; cherry-pick if rebase fails |
| Migration 0148 exists on main | Low | Medium | Renumber to main's max + 1 |
| Daemon's `console.log` replacement breaks logging | Low | Low | Logger utility is drop-in replacement |
| Tests after rebase don't pass | Medium | High | Fix and retest; if broken, debug per failure |
| Daemon requires Node.js APIs not available on CF Workers | Medium | High | Document as local-only tool; add runtime check |

## Next Steps

1. Invoke `/ck:plan` to generate implementation plan
2. Execute phases sequentially
3. Delete branch after merge
