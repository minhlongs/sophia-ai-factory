# Phase 42: TypeScript Cleanup — TS2339/TS2322 REMAINING BATCH

**Status:** 📋 READY FOR ASSIGNMENT (2026-04-26 post-Phase 41)
**Baseline:** 82 errors (post-Phase 41)
**Target:** Remaining TS2339 (×11) + TS2322 (×18) property mismatch + DB schema type assignment
**Priority:** **HIGH** (closes 29/82 errors, 35.4% phase reduction)
**Estimated Effort:** 2-3 hours (distributed batch)

---

## Overview

Phase 42 targets remaining high-frequency error types from Phase 41 carry-forwards. Current scope: 82 errors distributed across TS2339 (property access), TS2322 (type assignment), and other error types.

**Phase 41 M1 Doctrine Update:**
- Sub-Variant 4 pattern now prefers **canonical types** over inline interfaces
- Fallback to inline only if no canonical type exists
- Applied successfully to mapToExportRecord consolidation (Phase 41)

**Phase 41 H1 Carry-Forward (HIGH PRIORITY):**
- Auth null check is defensive but currently dead code (getAuth always returns truthy or throws)
- Better-auth-server signature should be explicit about throw/return semantics
- This will eliminate defensive null checking pattern across codebase

---

## Carries from Phase 41

### H1 (Dead Code Pattern)
- **File:** `src/app/api/auth/[...all]/route.ts`
- **Issue:** `const auth = getAuth()` followed by `if (!auth)` — getAuth never returns falsy or throws
- **Fix:** Refactor better-auth-server signature to explicitly communicate semantics
- **Impact:** Eliminates defensive null check, improves readability

### L1 (Already Migrated)
- `auth.toError()` already migrated to canonical pattern in Phase 40
- No additional work required

### L2 (Code Quality)
- GET/POST handler duplication in some routes — identify and DRY refactor
- Low priority, consider for Phase 43+

### M1 (KV Operations)
- KV delete() method may need implementation verification
- Carry from Phase 41 quota-checker-kv-cache work

---

## Recommended Strategy

**Scan & Batch by Error Type:**
1. Address H1 dead null check carry (better-auth-server signature clarification)
2. Identify remaining TS2339 high-frequency files (11 errors)
3. Apply HTTP boundary cast pattern (Sub-Variant 4 with canonical types)
4. Apply DB schema narrowing pattern (Sub-Variant 1 with canonical DB row types)
5. Target: -15 to -20 errors per phase

**Expected Reduction:** 82 → ~60-65 errors (24-27% phase progress)

---

## Success Criteria

- [ ] H1 carry addressed (better-auth-server signature clarification)
- [ ] TS2339 batch executed (property mismatch fixes)
- [ ] TS2322 batch executed (DB schema type assignment)
- [ ] Tests: 1398/1398 passing (zero regressions)
- [ ] Code review: >= 9.0/10
- [ ] M1 doctrine fully applied (canonical types preferred)
- [ ] L2/M1 carries documented for Phase 43+

---

## Related Links

- **Plan Overview:** `plan.md`
- **Phase 41 (prior):** `phase-41-typescript-cleanup.md`
- **Tech Debt Tracker:** `plans/reports/TECH_DEBT_TRACKING.md`
- **Phase 41 Reports:** `plans/reports/tester-260426-1515-b2-phase41-mixed-batch.md`

---

**Status:** READY FOR ASSIGNMENT
**Priority:** HIGH
**Timeline:** 2026-04-27+ (pending Phase 41 stakeholder review)
