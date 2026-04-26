# Phase 29: TypeScript Cleanup — TS2339 Property Mismatch Audit

**Status:** 📋 PLANNING (2026-04-26)  
**Scope:** 72 TS2339 errors (Property X does not exist on type Y)  
**Baseline:** 280 errors (post-Phase 28)  
**Target:** Property mismatch root-cause audit + targeted fixes  
**Priority:** HIGH (most common non-TS18046/non-QueryError type)

---

## Overview

Phase 29 focuses on TS2339 property mismatch errors — the highest-frequency remaining error type (72 instances). Unlike Phase 28's mechanical toError() pattern, Phase 29 requires case-by-case analysis to determine root causes:

1. **DB row shape mismatches** — Supabase/D1 query results don't match interfaces
2. **Schema evolution gaps** — Migration changes not reflected in type interfaces
3. **Optional field bugs** — Using required fields as optional or vice versa
4. **Cascading from Phase 27/28** — TS18046/TS2345 fixes exposed deeper issues

---

## High-Frequency TS2339 Sites (Preliminary)

### Known Candidates

| File | Error Count | Suspected Root Cause |
|------|-------------|----------------------|
| `src/lib/heygen/heygen-client.ts` | 5 | HTTP response shape (HeyGen API schema) |
| `src/app/admin/violations/violations-get-handler.ts` | 3 | DB row interface mismatch (unmigrated at L38) |
| (Others TBD via error categorization) | 64 | Mixed: schema evolution + optional semantics |

**Action Required:** Run `npx tsc --noEmit 2>&1 | grep "TS2339" | head -20` to identify top targets.

---

## Phase 26 Review Carries (Deferred from Phase 28)

These minor flags still available for Phase 29 if prioritized:

### Mi-1: JSDoc Clarification (Session-Trust Asymmetry)
- **File:** `src/lib/auth/is-user-admin.ts`
- **Effort:** 15 minutes
- **Status:** Available

### Mi-2: Unit Test Assertion Refinement
- **File:** `src/lib/auth/__tests__/is-user-admin.test.ts`
- **Effort:** 20 minutes
- **Status:** Available

### Mi-3: Tier Behavior Change Comment
- **File:** `src/app/api/usage/export/post-handler.ts` near L68
- **Effort:** 10 minutes
- **Status:** Available

---

## Carry-Forward Backlog (Still Pending)

**Phase 24 Doctrine Question:**
- `User.role?: string` optional vs required — research needed post-M2 refinement

**Phase 22 Dormant Items:**
- Polar/Stripe lifecycle logic (product decision needed)

**Phase 20 Long-Tail Candidates:**
- 5 TS2339 in `heygen-client.ts` (ideal Phase 29 target)

**Modularization Candidates:**
- `audit-log-table.tsx` > 200 LOC (Phase 24 defer)

**Type Safety Improvements (Phase 22+):**
- Structured error responses (P1)
- Subscription race window (P2)
- AuditLog camelCase mismatch (P3)

**Endpoint Consolidation:**
- Zod migration admin endpoints

---

## Phase 29 Execution Path Options

### Path A: Top-Down Breakdown (Recommended)

1. Run error categorization: `npx tsc --noEmit 2>&1 | grep "TS2339" | sort | uniq -c | sort -rn`
2. Target top 5 highest-frequency files
3. For each: identify root cause (DB schema, HTTP response, optional semantics)
4. Apply minimal fix: interface update, cast, or optional marker
5. Iterate until 72 → 0 (or carry to Phase 30 if high-risk)

**Estimated effort:** 4-5 hours (mix of 1-3 error per file, varying complexity)

### Path B: Known Candidates First (Fast Track)

1. Fix `heygen-client.ts` (5 errors, HTTP response shape)
2. Fix `violations-get-handler.ts` (3 errors, DB row shape L38)
3. Audit remaining (64 errors across other files)

**Estimated effort:** 2-3 hours (fast wins) + 2-3 hours (remaining audit)

---

## Success Criteria (Phase 29+)

- [ ] TS2339 errors categorized and root causes documented
- [ ] Top 5-10 high-frequency files targeted
- [ ] Property mismatch root causes fixed (72 → X)
- [ ] Tests: 1398/1398 passing (zero regressions)
- [ ] Code review: >= 9.5/10
- [ ] Phase 26 minor carries addressed (Mi-1/Mi-2/Mi-3 optional)

---

## Related Links

- **Phase 28 Completion:** `phase-28-typescript-cleanup.md`
- **Tech Debt Tracker:** `plans/reports/TECH_DEBT_TRACKING.md`
- **Code Standards:** `docs/code-standards.md`
- **Development Rules:** `.claude/rules/development-rules.md`

---

**Status:** READY FOR ASSIGNMENT  
**Priority:** HIGH (72 errors, highest non-TS18046/non-QueryError frequency)  
**Timeline:** 2026-04-27+ (pending stakeholder prioritization)  
**Notes:** Phase 28 mass refactor complete. Phase 29 targets property mismatch cleanup. Both Paths A (breakdown-first) and B (known-candidates-first) available for execution.
