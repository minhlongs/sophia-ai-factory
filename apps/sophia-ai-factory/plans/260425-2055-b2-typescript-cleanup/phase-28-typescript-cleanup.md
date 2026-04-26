# Phase 28: TypeScript Cleanup — Mass logger.error toError Refactor

**Status:** ✅ COMPLETED 2026-04-26 ~13:30 UTC
**Scope:** Mechanical wrap of `logger.error(QueryError)` → `toError()` across 33 sites  
**Baseline:** 313 errors → 280 errors (-33, all TS2345 QueryError eliminated)
**Files Modified:** 23 files  
**Pattern:** Canonical `toError()` helper (PostgrestError normalization for production logs)
**Priority:** HIGH (Technical debt reduction: 100% QueryError logging consistency)

---

## Completion Summary (2026-04-26 ~13:30 UTC)

**Status:** ✅ PHASE 28 COMPLETED

**Execution Results:**
- **Files modified:** 23 (mechanical wrap pattern)
- **TS errors eliminated:** 313 → 280 (-33, all TS2345 QueryError)
- **Pattern:** Canonical `toError()` helper for PostgrestError → JSON serialization
- **Tests:** 1398/1398 ✅ (zero regressions)
- **Code review:** 9.7/10 auto-approved
- **Implementation time:** ~2-2.5 hours (mechanical pattern)

**Key Achievement:** 100% QueryError logging consistency across all error handler sites. Fixes production logging issue where `logger.error(QueryError)` would serialize as `[object Object]`. Now captures code, details, hint properly.

**Reports:**
- Tester: `plans/reports/tester-260426-phase28-mass-toerror-verification.md`
- Code Review: `plans/reports/code-review-260426-1230-b2-phase28-mass-toerror.md`

---

## Overview

Phase 28 targeted high-frequency non-TS18046 error elimination via mechanical refactor pattern. Executed **Option C:** Mass logger.error refactor to canonical toError() helper, eliminating all TS2345 QueryError argument type mismatches (33 instances across 23 files). Zero behavioral change — pure error serialization normalization for production logs.

---

## Phase 28 Implementation Detail

### toError() Helper Pattern

**File:** `src/lib/logging/to-error.ts`

```typescript
// Canonical logger.error() wrapper — PostgrestError normalization
export const toError = (err: unknown) => {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      ...(err instanceof PostgrestError && {
        code: err.code,
        details: err.details,
        hint: err.hint,
      }),
    };
  }
  return err;
};
```

### Sites Updated (33 total, 23 files)

All `logger.error(QueryError)` calls wrapped with `toError()` at point of logging. Examples:
- Query failures in billing endpoints (3 sites)
- Dunning operations (5 sites)
- Usage reconciliation (4 sites)
- Admin license operations (6 sites)
- RAAS invoice generator (3 sites)
- Webhook handlers (2 sites)
- Session/auth operations (4 sites)
- Migration/schema operations (1 site)

**Result:** TS2345 QueryError argument mismatch eliminated across all sites. Production logs now capture PostgrestError metadata (code, details, hint) instead of `[object Object]`.

---

## Phase 26 Review Carries (Minor Flags, Optional)

### Mi-1: JSDoc Clarification (Session-Trust Asymmetry)

**File:** `src/lib/auth/is-user-admin.ts`  
**Effort:** 15 minutes (1-2 line doc update)  
**Priority:** LOWER (maintainability, Phase 26 review flag)  
**Status:** Available for Phase 28 if prioritized

### Mi-2: Unit Test Assertion Refinement

**File:** `src/lib/auth/__tests__/is-user-admin.test.ts`  
**Effort:** 20 minutes (assertion clarity)  
**Priority:** LOWER (code clarity, Phase 26 review flag)  
**Status:** Available for Phase 28 if prioritized

### Mi-3: Tier Behavior Change Comment

**File:** `src/app/api/usage/export/post-handler.ts` near L68  
**Effort:** 10 minutes (one-line comment)  
**Priority:** LOWER (code clarity, Phase 26 review flag)  
**Status:** Available for Phase 28 if prioritized

---

## Carry-Forward Backlog (Still Pending)

**Phase 24 Doctrine Question:**
- `User.role?: string` optional vs required — research needed
- Should non-optional constraint be added post-M2 refinement?

**Phase 22 Dormant Items:**
- Polar/Stripe lifecycle logic (product decision needed)

**Phase 20 Long-Tail Candidates:**
- 5 TS2339 in `heygen-client.ts` (low impact)

**Modularization Candidates:**
- audit-log-table.tsx > 200 LOC

**Type Safety Improvements (Phase 22+):**
- Structured error responses (P1)
- Subscription race window (P2)
- AuditLog camelCase mismatch (P3)

**Endpoint Consolidation:**
- Zod migration admin endpoints

---

## Phase 28 Success Criteria

- [x] All 33 logger.error(QueryError) sites identified and wrapped
- [x] toError() helper created and canonicalized
- [x] TS2345 QueryError eliminated (33 sites, 0 remaining)
- [x] Tests: 1398/1398 passing (zero regressions)
- [x] Code review: 9.7/10 auto-approved
- [x] Production logging normalized (PostgrestError metadata preserved)
- [x] Phase 26 minor carries deferred (Mi-1/Mi-2/Mi-3 still available Phase 29+)

---

## Related Links

- **Phase 27 Completion:** `phase-27-typescript-cleanup.md`
- **Tech Debt Tracker:** `plans/reports/TECH_DEBT_TRACKING.md`
- **Code Standards:** `docs/code-standards.md`
- **Development Rules:** `.claude/rules/development-rules.md`

---

**Status:** ✅ COMPLETED (2026-04-26)
**Priority:** HIGH (Technical debt reduction: QueryError logging consistency)
**Implementation Time:** ~2-2.5 hours (mechanical pattern)
**Next Phase:** Phase 29 (TS2339 property mismatch audit + Phase 26 minor carries)
