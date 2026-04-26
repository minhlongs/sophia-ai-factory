# Phase 28: TypeScript Cleanup — Non-TS18046 Error Categories (OPTIONAL)

**Status:** 📋 PLANNING (2026-04-26)  
**Scope:** Remaining 313 TypeScript errors (non-TS18046 categories)  
**Baseline:** 313 errors (TS2345, TS2322, TS2339, TS2538, TS2769, etc.)  
**Target:** Optional cleanup — no blocking requirements  
**Priority:** LOWER (TS18046 milestone already achieved)

---

## Overview

Phase 28 addresses remaining TypeScript errors **NOT in the TS18046 category**. Phase 27 completed 100% elimination of the TS18046 baseline (462 → 0). The remaining 313 errors represent different error types that may benefit from cleanup, but are not critical to the B2 initiative milestone.

**Decision Point:** Phase 28+ is optional. Phase 27 achieved the primary milestone. Phase 28 can be deferred pending prioritization with stakeholders.

---

## Remaining Error Categories (313 Total)

### Breakdown by Error Type (To Be Categorized)

```
TS2345 - Argument of type X is not assignable to parameter of type Y
TS2322 - Type X is not assignable to type Y
TS2339 - Property X does not exist on type Y
TS2538 - Type Y cannot be used as an index type
TS2769 - No overload matches this call
TS2531 - Object is possibly 'null'
TS2532 - Object is possibly 'undefined'
(Additional types TBD via categorization pass)
```

**Action Required:** Run `npx tsc --noEmit 2>&1 | grep -o 'TS[0-9]*' | sort | uniq -c | sort -rn` to generate exact breakdown.

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

## Success Criteria (OPTIONAL)

**IF Phase 28 Proceeds:**
- [ ] Error breakdown categorized by type (TS2345, TS2322, TS2339, etc.)
- [ ] Top N errors targeted for reduction
- [ ] Tests: 1398/1398 passing (zero regressions)
- [ ] Code review: >= 9.5/10
- [ ] Phase 26 minor carries addressed (Mi-1/Mi-2/Mi-3 optional)

**IF Phase 28 Deferred:**
- [x] TS18046 milestone achieved (100% elimination)
- [x] Protected flow verified (Telegram)
- [x] 1398/1398 tests passing
- [x] Initiative closure documented

---

## Related Links

- **Phase 27 Completion:** `phase-27-typescript-cleanup.md`
- **Tech Debt Tracker:** `plans/reports/TECH_DEBT_TRACKING.md`
- **Code Standards:** `docs/code-standards.md`
- **Development Rules:** `.claude/rules/development-rules.md`

---

**Status:** AWAITING STAKEHOLDER DECISION  
**Priority:** OPTIONAL (TS18046 milestone already achieved)  
**Timeline:** 2026-04-27+ (pending prioritization)  
**Notes:** Phase 27 marks successful completion of B2 TS18046 elimination initiative. Phase 28+ is optional cleanup for non-TS18046 error types.
