# T007 — `src/lib/` Compatibility Plan

> Migration plan for the `src/lib/` legacy compatibility area.
> Owner: CTO | Priority: P2 | Depends on: T001

---

## Executive Summary

**The code migration is already complete.** Commit `bd053b74f` (June 5, 2026) migrated all 523 files and deleted the `src/lib/` directory. Zero `@/lib/` imports remain in source code. Zero banned imports exist. The `scripts/check-layer-imports.ts` lint gate enforces layer boundaries on every run.

**Remaining work is documentation-only:** 57 stale `@/lib/` references across 10 documentation files that still cite the old paths as canonical. This plan covers that final cleanup.

---

## Current Inventory

### Files in `src/lib/`

```
$ find src/lib/ -type f 2>/dev/null
(empty)
```

**The directory does not exist.** Removed in commit `bd053b74f` (2026-06-05), which migrated 523 files, deleted 19,878 lines, and moved all modules to `seed/`, `tree/`, `forest/`, or `land/`.

### `@/lib/` imports in source code

```
$ grep -rn '@/lib/' src/ --include='*.ts' --include='*.tsx'
(empty — 0 matches)
```

### Banned imports

| Banned path | Matches in `src/` | Enforcement |
|---|---|---|
| `@/lib/auth` | 0 | `scripts/check-layer-imports.ts` |
| `@/lib/subscription` | 0 | same |
| `@/lib/unified-tier-config` | 0 | same |
| `@/lib/tier-gate` | 0 | same |

### `@/lib/` references in non-source files (stale documentation)

| File | Approx. count | Nature |
|---|---|---|
| `CONTRIBUTING.md` | 3 | Lists old canonical imports |
| `docs/code-standards.md` | 8 | References `@/lib/logger`, `@/lib/utils/*`, `@/lib/http-client` |
| `docs/code-standards-advanced-patterns.md` | 6 | References `@/lib/services/*`, `@/lib/auth/*`, `@/lib/db/client` |
| `docs/contributor-handover.md` | 4 | Lists old canonical imports |
| `docs/usage-metering.md` | 5 | References `@/lib/usage-metering` |
| `docs/usage-metering/reference.md` | 3 | References `@/lib/usage-metering` |
| `docs/dev-sops.md` | 1 | References `src/lib/observability/sentry-options.ts` |
| `docs/system-architecture.md` | — | Minor references |
| `docs/codebase-summary.md` | 1 | Lists banned imports |
| `docs/architecture/REPO_RECONNAISSANCE_2026-08-17.md` | 1 | Recon doc |
| `docs/security-hardening-implementation.md` | — | Minor references |
| `.claude/commands/pilot.md` | 2 | References `@/lib/better-auth-session`, `@/lib/db/client` as canonical |
| `.claude/rules/sophia-layer-architecture.md:62` | 1 | States `src/lib/*` still exists |
| `eslint.config.mjs:21` | 1 | ESLint message references `@/lib/utils/to-error` |
| `scripts/check-layer-imports.ts` | — | Correct (lint detector — not stale) |
| `scripts/codemod-rewrite-imports*.mts` | — | Correct (migration tooling — not stale) |
| `scripts/rollback-*.py` | — | Correct (rollback tooling — not stale) |
| `docs/project-changelog.md` | — | Historical record — DO NOT change |

**Total stale references: ~57 across 10 files** (excluding changelog, scripts, lint gate).

---

## Target Locations (Post-Migration Mapping)

The `src/lib/` directory has been fully migrated. Here is where its former contents now live, based on the 4-layer architecture rules:

| Former `src/lib/` path | Current location | Layer |
|---|---|---|
| `lib/auth/*` | `seed/auth/` | seed |
| `lib/db/*` | `seed/db/` | seed |
| `lib/config/*` | `seed/config/` | seed |
| `lib/utils/*` | `seed/utils/` | seed |
| `lib/types/*` | `seed/types/` | seed |
| `lib/security/*` | `seed/security/` | seed |
| `lib/logger*` | `seed/utils/logger-utility.ts` | seed |
| `lib/byok/*` | `seed/byok/` | seed |
| `lib/services/*` | `seed/services/` | seed |
| `lib/usage-metering/*` | `forest/usage-metering/` | forest |
| `lib/inngest/*` | `forest/inngest/` | forest |
| `lib/raas/*` | `forest/raas/` | forest |
| `lib/quota/*` | `forest/quota/` | forest |
| `lib/subscription*` | `seed/db/get-user-tier.ts` | seed |
| `lib/tier-gate*` | `seed/db/get-user-tier.ts` | seed |
| `lib/unified-tier-config*` | `seed/config/tiers/` | seed |
| `lib/billing/*` | `land/billing/` | land |
| `lib/payouts/*` | `land/payouts/` | land |
| `lib/affiliates/*` | `land/affiliates/` | land |

No files should be moved — the migration is complete. The mapping above is for reference when updating documentation.

---

## Phased Migration Plan

### Phase 0: Code Migration — ALREADY COMPLETE

- **Status:** DONE (commit `bd053b74f`, 2026-06-05)
- **Scope:** 523 files migrated, 19,878 lines deleted, `src/lib/` deleted
- **Banned imports:** Zero in source
- **Lint gate:** `scripts/check-layer-imports.ts` enforces layer boundaries

### Phase 1: Documentation Cleanup (Only Remaining Work)

**Priority:** P2
**Risk:** LOW (docs only, no code changes)
**Estimated effort:** 1-2 hours

#### 1a. Update `.claude/rules/sophia-layer-architecture.md`

Line 62 currently reads:
> `src/lib/*` vẫn tồn tại như vùng compatibility/shared logic lịch sử.

**Action:** Update the "Unresolved" section to reflect that `src/lib/` has been removed and no longer exists. Replace with a note that the migration is complete and no new imports should reference it.

#### 1b. Update `CONTRIBUTING.md`

Lines 13-14 reference `@/lib/db/client` and `@/lib/better-auth-session` as canonical imports.

**Action:** Update to current canonical paths:
- `@/lib/db/client` → `@/seed/db/client`
- `@/lib/better-auth-session` → `@/seed/auth/better-auth-session`

#### 1c. Update `docs/code-standards.md`

References `@/lib/logger`, `@/lib/utils/to-error`, `@/lib/utils/logger-utility`, `@/lib/http-client`.

**Action:** Map each to current location:
- `@/lib/logger` → `seed/utils/logger-utility.ts`
- `@/lib/utils/to-error` → grep for actual current path
- `@/lib/utils/logger-utility` → `seed/utils/logger-utility.ts`
- `@/lib/http-client` → grep for actual current path

#### 1d. Update `docs/code-standards-advanced-patterns.md`

References `@/lib/services/*`, `@/lib/auth/*`, `@/lib/db/client`.

**Action:** Update all to `seed/` equivalents. This is the largest doc file to update (~8 references).

#### 1e. Update `docs/contributor-handover.md`

Lines 46-81 reference old canonical imports and deleted files.

**Action:** Replace old canonical path table with current paths.

#### 1f. Update `docs/usage-metering.md` and `docs/usage-metering/reference.md`

References `@/lib/usage-metering`.

**Action:** Update to `@/forest/usage-metering/` (or the specific subpath used).

#### 1g. Update remaining files

- `docs/dev-sops.md:349` — references `src/lib/observability/sentry-options.ts`
- `.claude/commands/pilot.md:55-56` — references old canonical imports
- `eslint.config.mjs:21` — ESLint message references `@/lib/utils/to-error`
- `docs/codebase-summary.md:253` — lists banned imports (may be fine as historical note)

#### 1h. Files NOT to change

- `docs/project-changelog.md` — historical record
- `scripts/check-layer-imports.ts` — lint detector (intentionally references banned paths)
- `scripts/codemod-rewrite-imports*.mts` — migration tooling
- `scripts/rollback-*.py` — rollback tooling

---

## Circular Dependency Risk Assessment

### Current State (Post-Migration)

| Risk | Status | Detail |
|---|---|---|
| Direct `land → forest` | **Mitigated** | `check-layer-imports.ts` rejects this |
| Transitive `land → land → forest` | **Mitigated** | Lines 17-18 of lint gate detect this |
| `seed → tree/forest/land` | **Mitigated** | Lint gate rejects seed imports of business layers |
| `tree → forest/land` | **Mitigated** | Lint gate rejects tree imports of forest/land |
| Orphaned `@/lib/` imports | **None** | Zero matches in source |

### No remaining circular dependency risks

With `src/lib/` deleted and the lint gate enforcing all four layer boundaries, there are no circular dependency paths. The only remaining risk is if someone adds a new `@/lib/` alias in `tsconfig.json`, but:
1. The lint gate catches any `@/lib/` imports in source
2. The banned imports list prevents the most dangerous paths
3. `tsconfig.json` aliases map `@/*` → `./src/*`, so `@/lib/` would resolve to nothing (directory deleted)

---

## Acceptance Criteria

### T007 Task-Level Acceptance (ALL MET)

| Criterion | Status | Evidence |
|---|---|---|
| Current `src/lib/*` usage mapped | **MET** | Directory deleted, 0 files, 0 imports |
| New imports remain banned for auth/db/tier | **MET** | 0 banned imports in source; lint gate enforced |
| Refactor path prioritized by risk | **MET** | Phased migration completed via `bd053b74f` |

### Phase 1 (Doc Cleanup) Acceptance

| Criterion | Validation |
|---|---|
| Zero stale `@/lib/` references in non-tooling docs | `grep -rn '@/lib/' docs/ CONTRIBUTING.md` returns only changelog and scripts |
| `.claude/rules/sophia-layer-architecture.md` reflects current state | "Unresolved" section updated |
| All canonical import examples in docs use `seed/tree/forest/land/` paths | Spot-check CONTRIBUTING.md, code-standards.md |
| `npm run build` still passes | Run after doc changes |
| No code changes required | Only `.md` files and one `.mjs` message updated |

---

## Rollback Plan

### Phase 0 (Code Migration) — Rollback

If the code migration ever needed reverting (it does not at this point):
1. `git revert bd053b74f` — reverts the full migration commit
2. Run `scripts/rollback-imports.py` to restore `@/lib/` import paths in source files
3. Restore `src/lib/` directory from git history
4. Run `npm run build` to verify

**This is NOT needed** — the migration has been stable since June 5, 2026 with no regressions.

### Phase 1 (Doc Cleanup) — Rollback

Each documentation change is independent and low-risk:
1. `git checkout HEAD -- docs/CONTRIBUTING.md` (or any single file)
2. No build/test impact from documentation changes

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Doc update breaks a link or example | Low | Low | Doc-only, no runtime impact |
| New `@/lib/` import sneaks in | Low | Medium | Lint gate catches it |
| `src/lib/` recreated by mistake | Very Low | Medium | `tsconfig.json` path doesn't resolve |
| Code-standards doc mentions path that doesn't exist | Medium | Low | Verify each path with `grep` before updating |

---

## Summary

T007 is **95% complete**. The entire code migration was done in June 2026 (commit `bd053b74f`). The `src/lib/` directory no longer exists, zero `@/lib/` imports remain in source, and the layer boundary lint gate enforces the architecture on every run.

The remaining 5% is a documentation cleanup pass: updating ~57 stale `@/lib/` references across 10 documentation files to reflect the current `seed/tree/forest/land/` canonical paths. This is a low-risk, ~1-2 hour effort that can be done by any contributor familiar with the current architecture.

**Recommendation:** Execute Phase 1 (doc cleanup) to formally close T007, then mark the constitution task as complete.
