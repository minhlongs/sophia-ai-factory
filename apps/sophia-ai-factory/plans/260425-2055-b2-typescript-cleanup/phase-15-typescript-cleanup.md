# Phase 15: TypeScript TS18046 Cleanup (Backlog Ready)

**Status:** Pending | Candidate Selection Ready
**Target Errors:** 32 TS18046 remaining (Phase 14 baseline)
**Methodology:** Inline narrowest `as` type assertions (proven Phase 7-14 approach)
**Success Criteria:** -2 to -3 errors, 100% test pass rate, 9.5+/10 review score

---

## Overview

Continue B2 TS18046 cleanup using proven inline cast methodology. Phase 14 completed with request-body HTTP boundary pattern on `coupons/apply/route.ts` (-3 errors, 9.8/10). Phase 15 targets coupon activation with similar request-body pattern.

---

## Backlog Candidates (Updated 2026-04-26 08:40)

### Candidate 1: `src/app/api/coupons/activate/route.ts` (RECOMMENDED FIRST)
- **Error Count:** 2 TS18046 instances
- **Type:** API activation handler
- **Protected Flow Risk:** Low-medium — coupon activation (same system as Phase 14 apply route)
- **Estimated Effort:** 2-3 hours
- **Pattern Match:** Identical to Phase 14 (request-body HTTP boundary)
- **Recommendation:** START HERE — lowest error count, proven pattern just applied in Phase 14, minimal risk

### Candidate 2: `src/app/api/usage/reconciliation/sync/route.ts` (Alternative)
- **Error Count:** 2 TS18046 instances
- **Type:** Usage reconciliation sync endpoint
- **Protected Flow Risk:** Medium — usage metering critical path
- **Estimated Effort:** 2-3 hours
- **Pattern Match:** Similar to Phase 13 (single-endpoint)
- **Note:** Related to quota system (Phase 12 reference)
- **Recommendation:** Defer to Phase 15.5 if activate route deferred. Verify quota system interactions first.

### Candidate 3: `src/app/api/admin/dunning/[licenseNonce]/restore/route.ts` (Very Low Risk)
- **Error Count:** 1 TS18046 instance
- **Type:** License dunning restoration handler
- **Protected Flow Risk:** Low — admin operation (non-customer-facing)
- **Estimated Effort:** 1-2 hours
- **Pattern Match:** Similar to Phases 10-11 (response-body variant)
- **Recommendation:** Hold for Phase 15.5+ due to single-error scope. Batching with other restore/suspend routes recommended.

### Candidate 4: `src/app/api/admin/dunning/[licenseNonce]/suspend/route.ts` (Very Low Risk)
- **Error Count:** 1 TS18046 instance
- **Type:** License dunning suspension handler
- **Protected Flow Risk:** Low — admin operation
- **Estimated Effort:** 1-2 hours
- **Pattern Match:** Similar to Phases 10-11
- **Recommendation:** Batch with restore route as Phase 15.5 (2 errors combined).

### Candidate 5: `src/components/mcu-balance-widget.tsx` (Response Variant)
- **Error Count:** 3 TS18046 instances
- **Type:** Widget component with HTTP boundary
- **Protected Flow Risk:** Low — internal dashboard UI
- **Estimated Effort:** 2-3 hours
- **Pattern Match:** Similar to Phases 9-10 (response-body variant)
- **Recommendation:** Hold for Phase 16 pending Phase 15 completion. Component-based pattern.

### DEFER: `src/app/api/webhooks/telegram/route.ts` (HIGH RISK)
- **Error Count:** 4 TS18046 instances
- **Type:** Telegram webhook payload handling (Protected Flow #2)
- **Protected Flow Risk:** ⚠️ HIGH — Telegram bot critical (@Sophia_Bbot)
- **Note:** Webhook signature verification, IPN idempotency checks required
- **Recommendation:** Requires specialized planning, extra code review, integration testing. Schedule for Phase 16+ with dedicated webhook testing plan.

### DEFER: `src/app/api/licenses/[id]/reactivate/route.ts` (Scope Verification)
- **Error Count:** 3 TS18046 instances
- **Type:** License reactivation API handler
- **Protected Flow Risk:** Medium — licensing core logic
- **Note:** Verify if payment-adjacent (Protected Flow #3). Requires scope confirmation before assignment.
- **Recommendation:** Confirm licensing scope with team lead before Phase 15.5 assignment.

---

## Phase 15 Selection Criteria

**Priority Order:**
1. **`coupons/activate/route.ts`** ← RECOMMENDED for Phase 15 (START HERE)
2. `usage/reconciliation/sync/route.ts` (alternative if activate deferred)
3. `admin/dunning/*` routes (batch for Phase 15.5 as 2-error combo)
4. `mcu-balance-widget.tsx` (candidate for Phase 16)
5. `licenses/[id]/reactivate/route.ts` (candidate for Phase 15.5+ pending verification)
6. `webhooks/telegram/route.ts` (candidate for Phase 16+ — high risk, requires special planning)

**Selection Rationale for Phase 15:**
- Candidate 1: Lowest error count (2), proven pattern from Phase 14 (same coupon system), immediate risk-to-reward ratio favorable
- Same request-body HTTP boundary pattern as Phase 14 — zero learning curve
- Related to Phase 14 implementation context — cognitive continuity
- Minimal scope change from previous phase

---

## Implementation Plan (Template for `coupons/activate/route.ts`)

1. **Read file:** Understand request activation payload, response structure, API contract
2. **Analyze errors:** List all 2 TS18046 errors with exact line numbers
3. **Type analysis:** Determine if inline `as` is safe (each error targets distinct shape)
4. **Draft changes:** Apply narrowest scope casts (request body + response handler)
5. **Test:** `npm test` → verify 100% pass, focus on coupon-related tests
6. **Review:** Code review for 9.5+/10 approval
7. **Commit:** Conventional format

**Expected Effort:** 2-3 hours total

---

## Success Criteria

- [ ] Phase 15 target file identified and assigned
- [ ] TS18046 errors reduced by 2 (32 → 30)
- [ ] Tests: 1394/1394 passing
- [ ] Code review: 9.5+/10 approved
- [ ] Commit: Conventional format, descriptive message
- [ ] Phase 16 backlog identified

---

## Quality Gates

- TypeScript: `npx tsc --noEmit` → 32 TS18046 baseline met
- Tests: `npm test` → 100% pass rate
- Review: >= 9.5/10 quality score
- Type Safety: All inline casts documented
- No protected flows affected (coupon system low-risk)

---

## Key Links

- **Plan Overview:** `plans/260425-2055-b2-typescript-cleanup/plan.md`
- **Phase 14 Reference:** `plans/260425-2055-b2-typescript-cleanup/phase-14-typescript-cleanup.md`
- **Phase 14 Tester Report:** `plans/reports/tester-260426-0840-b2-phase14-coupons-apply.md`
- **Phase 14 Review Report:** `plans/reports/code-review-260426-0840-b2-phase14-coupons-apply.md`
- **Tech Debt Tracker:** `plans/TECH_DEBT_TRACKING.md`

---

**Status:** Backlog candidates identified, Phase 15 ready for assignment
**Next Step:** Delegate Phase 15 implementation (recommend `coupons/activate/route.ts`)
**Estimated Duration:** Phase 15 implementation ~2-3 hours
