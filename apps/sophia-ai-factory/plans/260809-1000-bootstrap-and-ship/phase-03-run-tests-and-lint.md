# Phase 03: Run Full Test Suite + Lint

**Priority:** HIGH
**Status:** Pending
**Dependencies:** Phase 01, 02

---

## Context Links
- Current test status: 6557 passed, 1 failed (import), 34 skipped, 10 todo
- Lint not yet run

---

## Overview
Run complete test suite and linting to verify all quality gates pass.

---

## Implementation Steps
1. Run `npm test` — verify all 6600+ tests pass
2. Run `npm run lint` — verify 0 errors (warnings OK per CI config: `--max-warnings=341`)
3. Run `npm run type-check` — confirm 0 errors (should pass from Phase 01)
4. Run `npm run build` — confirm build completes

---

## Todo List
- [ ] `npm test` → all pass
- [ ] `npm run lint` → 0 errors
- [ ] `npm run type-check` → 0 errors
- [ ] `npm run build` → success

---

## Success Criteria
- All quality gates green
- No regressions introduced by type fixes

---

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Flaky tests | Low | Medium | Re-run if needed |
| Lint warnings exceed threshold | Medium | Low | CI allows 341 warnings |

---

## Next Steps
→ Phase 04: Validate Protected Flows