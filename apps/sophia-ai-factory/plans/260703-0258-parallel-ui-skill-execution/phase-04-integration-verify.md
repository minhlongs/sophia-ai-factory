---
phase: 4
title: "Integration & Verify"
status: pending
priority: P1
dependencies: [1, 2, 3]
---

# Phase 4: Integration & Verify

## Overview

Final verification pass after all 3 groups complete. Runs type-check, build, tests, i18n autofill, and final diff review.

**Depends on:** Phases 1, 2, 3 completing successfully.

## Implementation Steps

1. **Merge all parallel changes** — Verify no file conflicts between groups
2. **i18n autofill** — `npm run i18n:autofill` to catch any missing translation keys
3. **Type check** — `npm run type-check` (must pass with 0 errors)
4. **Build** — `npm run build` (must pass with 0 errors)
5. **Test** — `npm test` (all 6772+ tests must pass)
6. **Final diff review** — Verify all changed files use indigo dark theme
7. **Update existing plan** — Mark `260703-0149-full-ui-redesign` phases as completed

## Success Criteria

- [ ] `npm run type-check` — 0 errors
- [ ] `npm run build` — 0 errors, exit code 0
- [ ] `npm test` — all tests pass
- [ ] i18n autofill completes with no unresolved keys
- [ ] Zero files with old purple `#D946EF` in src/app/components/sections/
- [ ] No `console.log` or `:any` types in new/modified files

## Risk Assessment

- Risk: Parallel work causes merge conflicts → **Mitigation:** Groups have exclusive file ownership verified before merge
