# Phase 14: TypeScript TS18046 Cleanup (Backlog Ready)

**Status:** Pending | Candidate Selection Ready
**Target Errors:** 35 TS18046 remaining (current baseline)
**Methodology:** Inline narrowest `as` type assertions (proven Phase 7-13 approach)
**Success Criteria:** -2 to -3 errors, 100% test pass rate, 9.5+/10 review score

---

## Overview

Continue B2 TS18046 cleanup using proven inline cast methodology. Phase 13 completed with single-endpoint HTTP boundary pattern on `referral-share-widget.tsx` (-2 errors, 9.8/10). Phase 14 will target next highest-concentration file from identified backlog.

---

## Backlog Candidates (Updated 2026-04-26)

### Candidate 1: `src/app/api/coupons/apply/route.ts` (RECOMMENDED FIRST)
- **Error Count:** 3 TS18046 instances
- **Type:** API request/response payload handling
- **Protected Flow Risk:** Medium — coupon application logic (pricing/discount, not in primary 3 protected flows)
- **Estimated Effort:** 3-4 hours
- **Pattern Match:** Similar to Phase 9-10 (request body unknown pattern)
- **Recommendation:** START HERE — medium risk, clear scope, request body pattern documented

### Candidate 2: `src/app/api/coupons/activate/route.ts` (Lower Risk Alternative)
- **Error Count:** 2 TS18046 instances
- **Type:** API activation handler
- **Protected Flow Risk:** Low-medium — coupon activation (similar scope to Candidate 1)
- **Estimated Effort:** 2-3 hours
- **Pattern Match:** Similar to Phase 13 (single-endpoint)
- **Note:** Lower error count but slightly different scope than apply route
- **Recommendation:** Defer to Phase 14.5 if Phase 14 runs over budget

### Candidate 3: `src/app/api/licenses/[id]/reactivate/route.ts` (Verify Scope First)
- **Error Count:** 3 TS18046 instances
- **Type:** License reactivation API handler
- **Protected Flow Risk:** Medium — licensing core logic (verify if payment-adjacent)
- **Note:** Requires scope verification before assigning
- **Requirement:** Confirm licensing scope with team lead before proceeding
- **Recommendation:** Hold for Phase 15 pending verification

### Candidate 4: `src/app/api/usage/reconciliation/sync/route.ts` (Defer to Phase 15+)
- **Error Count:** 2 TS18046 instances
- **Type:** Usage reconciliation sync endpoint
- **Protected Flow Risk:** Medium — usage metering critical path
- **Note:** Related to quota system (Phase 12 reference)
- **Recommendation:** Defer to Phase 15 pending quota system verification

### Candidate 5: `src/app/api/webhooks/telegram/route.ts` (DEFER TO PHASE 16+)
- **Error Count:** 4 TS18046 instances
- **Type:** Webhook payload handling
- **Protected Flow Risk:** ⚠️ HIGH — Telegram bot critical flow (protected flow #2)
- **Note:** DEFER — requires webhook integration test strategy + signature verification review
- **Requirement:** Extra code review + integration testing + rollback plan
- **Recommendation:** Requires specialized planning before assignment

---

## Phase 14 Selection Criteria

**Priority Order:**
1. **`coupons/apply/route.ts`** ← RECOMMENDED for Phase 14
2. `coupons/activate/route.ts` (alternative if apply route deferred)
3. `licenses/[id]/reactivate/route.ts` (candidate for Phase 15 pending verification)
4. `usage/reconciliation/sync/route.ts` (candidate for Phase 15 pending verification)
5. `telegram/route.ts` (candidate for Phase 16+ — high risk)

**Selection Rationale:**
- Medium error count (3 errors, manageable scope)
- Clear API request/response boundary pattern
- Proven HTTP boundary cast pattern applies directly
- Medium risk profile acceptable after Phase 13 success
- Related to pricing system (non-critical path)

---

## Implementation Plan (Template)

### For `coupons/apply/route.ts` Target:

1. **Read file:** Understand request body shape, response structure, API contract
2. **Analyze errors:** List all 3 TS18046 errors with exact line numbers
3. **Type analysis:** Determine if inline `as` is safe (each error targets distinct shape)
4. **Draft changes:** Apply narrowest scope casts (request body + response handler)
5. **Test:** `npm test` → verify 100% pass, focus on coupon-related tests
6. **Review:** Code review for 9.5+/10 approval
7. **Commit:** Conventional format

**Expected Effort:** 3-4 hours total

---

## Success Criteria

- [ ] Phase 14 target file identified and assigned
- [ ] TS18046 errors reduced by 2-3 (35 → 32-33)
- [ ] Tests: 1394/1394 passing
- [ ] Code review: 9.5+/10 approved
- [ ] Commit: Conventional format, descriptive message
- [ ] Phase 15 backlog identified

---

## Quality Gates

- TypeScript: `npx tsc --noEmit` → 35 TS18046 baseline met
- Tests: `npm test` → 100% pass rate
- Review: >= 9.5/10 quality score
- Type Safety: All inline casts documented
- No protected flows affected (coupon system non-critical)

---

## Key Links

- **Plan Overview:** `plans/260425-2055-b2-typescript-cleanup/plan.md`
- **Phase 13 Reference:** `plans/260425-2055-b2-typescript-cleanup/phase-13-typescript-cleanup.md`
- **Phase 13 Tester Report:** `plans/reports/tester-260426-0835-b2-phase13-referral-widget.md`
- **Phase 13 Review Report:** `plans/reports/code-review-260426-1030-b2-phase13-referral-widget.md`
- **Tech Debt Tracker:** `plans/TECH_DEBT_TRACKING.md`

---

**Status:** Backlog candidates identified, Phase 14 ready for assignment
**Next Step:** Delegate Phase 14 implementation (recommend `coupons/apply/route.ts`)
**Estimated Duration:** Phase 14 implementation ~3-4 hours
