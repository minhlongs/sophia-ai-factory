# Phase 16: TypeScript TS18046 Cleanup (Backlog Ready)

**Status:** Pending | Candidate Selection Ready
**Target Errors:** 30 TS18046 remaining (Phase 15 baseline)
**Methodology:** Inline narrowest `as` type assertions (proven Phase 7-15 approach)
**Success Criteria:** -2 to -3 errors, 100% test pass rate, 9.5+/10 review score

---

## Overview

Continue B2 TS18046 cleanup using proven inline cast methodology. Phase 15 completed with request-body HTTP boundary pattern on `coupons/activate/route.ts` (-2 errors, 9.8/10). Phase 16 targets usage reconciliation sync with similar quota system context.

---

## Backlog Candidates (Updated 2026-04-26 08:55)

### Candidate 1: `src/app/api/usage/reconciliation/sync/route.ts` (RECOMMENDED FIRST)
- **Error Count:** 2 TS18046 instances
- **Type:** Usage reconciliation sync endpoint
- **Protected Flow Risk:** Medium — usage metering critical path (quota system adjacent)
- **Estimated Effort:** 2-3 hours
- **Pattern Match:** Similar to Phase 13 (single-endpoint)
- **Recommendation:** START HERE — lowest error count, proven request-body pattern, quota system context clear from Phase 12

### Candidate 2: `src/components/mcu-balance-widget.tsx` (Response Variant)
- **Error Count:** 3 TS18046 instances
- **Type:** Widget component with HTTP boundary
- **Protected Flow Risk:** Low — internal dashboard UI
- **Estimated Effort:** 2-3 hours
- **Pattern Match:** Similar to Phases 9-10 (response-body variant)
- **Recommendation:** Alternative if usage/reconciliation deferred. Component-based pattern.

### Candidate 3: `src/app/api/admin/dunning/[licenseNonce]/restore/route.ts` (Very Low Risk)
- **Error Count:** 1 TS18046 instance
- **Type:** License dunning restoration handler
- **Protected Flow Risk:** Low — admin operation (non-customer-facing)
- **Estimated Effort:** 1-2 hours
- **Pattern Match:** Similar to Phases 10-11 (response-body variant)
- **Recommendation:** Hold for Phase 16.5+ due to single-error scope. Batching with suspend route recommended (2 errors combined).

### Candidate 4: `src/app/api/admin/dunning/[licenseNonce]/suspend/route.ts` (Very Low Risk)
- **Error Count:** 1 TS18046 instance
- **Type:** License dunning suspension handler
- **Protected Flow Risk:** Low — admin operation
- **Estimated Effort:** 1-2 hours
- **Pattern Match:** Similar to Phases 10-11
- **Recommendation:** Batch with restore route as Phase 16.5 (2 errors combined).

### DEFER: `src/app/api/webhooks/telegram/route.ts` (HIGH RISK)
- **Error Count:** 4 TS18046 instances
- **Type:** Telegram webhook payload handling (Protected Flow #2)
- **Protected Flow Risk:** ⚠️ HIGH — Telegram bot critical (@Sophia_Bbot)
- **Note:** Webhook signature verification, IPN idempotency checks required
- **Recommendation:** Requires specialized planning, extra code review, integration testing. Schedule for Phase 17+ with dedicated webhook testing plan.

### DEFER: `src/app/api/licenses/[id]/reactivate/route.ts` (Scope Verification)
- **Error Count:** 3 TS18046 instances
- **Type:** License reactivation API handler
- **Protected Flow Risk:** Medium — licensing core logic
- **Note:** Verify if payment-adjacent (Protected Flow #3). Requires scope confirmation before assignment.
- **Recommendation:** Confirm licensing scope with team lead before Phase 16.5 assignment.

---

## Phase 16 Selection Criteria

**Priority Order:**
1. **`usage/reconciliation/sync/route.ts`** ← RECOMMENDED for Phase 16 (START HERE)
2. `mcu-balance-widget.tsx` (alternative if reconciliation deferred)
3. `admin/dunning/*` routes (batch for Phase 16.5 as 2-error combo)
4. `licenses/[id]/reactivate/route.ts` (candidate for Phase 16.5+ pending verification)
5. `webhooks/telegram/route.ts` (candidate for Phase 17+ — high risk, requires special planning)

**Selection Rationale for Phase 16:**
- Candidate 1: Lowest error count (2), proven pattern from Phases 13-15 (same quota system context), immediate risk-to-reward ratio favorable
- Same request-body HTTP boundary pattern as Phase 15 — zero learning curve
- Related to Phase 12 implementation context (quota dashboard) — cognitive continuity
- Minimal scope change from previous phases

---

## Implementation Plan (Template for `usage/reconciliation/sync/route.ts`)

1. **Read file:** Understand reconciliation payload, sync request/response structure, API contract
2. **Analyze errors:** List all 2 TS18046 errors with exact line numbers
3. **Type analysis:** Determine if inline `as` is safe (each error targets distinct shape)
4. **Draft changes:** Apply narrowest scope casts (request body + sync response handler)
5. **Test:** `npm test` → verify 100% pass, focus on usage-related tests
6. **Review:** Code review for 9.5+/10 approval
7. **Commit:** Conventional format

**Expected Effort:** 2-3 hours total

---

## Success Criteria

- [ ] Phase 16 target file identified and assigned
- [ ] TS18046 errors reduced by 2 (30 → 28)
- [ ] Tests: 1394/1394 passing
- [ ] Code review: 9.5+/10 approved
- [ ] Commit: Conventional format, descriptive message
- [ ] Phase 17 backlog identified

---

## Quality Gates

- TypeScript: `npx tsc --noEmit` → 30 TS18046 baseline met
- Tests: `npm test` → 100% pass rate
- Review: >= 9.5/10 quality score
- Type Safety: All inline casts documented
- No protected flows affected (reconciliation system medium-risk, manageable)

---

## Key Links

- **Plan Overview:** `plans/260425-2055-b2-typescript-cleanup/plan.md`
- **Phase 15 Reference:** `plans/260425-2055-b2-typescript-cleanup/phase-15-typescript-cleanup.md`
- **Phase 15 Tester Report:** `plans/reports/tester-260426-0854-b2-phase15-coupons-activate.md`
- **Phase 15 Review Report:** `plans/reports/code-review-260426-0853-b2-phase15-coupons-activate.md`
- **Phase 12 Reference:** `plans/260425-2055-b2-typescript-cleanup/phase-12-typescript-cleanup.md` (quota system context)
- **Tech Debt Tracker:** `plans/TECH_DEBT_TRACKING.md`

---

**Status:** Backlog candidates identified, Phase 16 ready for assignment
**Next Step:** Delegate Phase 16 implementation (recommend `usage/reconciliation/sync/route.ts`)
**Estimated Duration:** Phase 16 implementation ~2-3 hours
