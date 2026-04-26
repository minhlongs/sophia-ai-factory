# Phase 17: TypeScript TS18046 Cleanup (Backlog Ready)

**Status:** Pending | Candidate Selection Ready
**Target Errors:** 28 TS18046 remaining (Phase 16 baseline)
**Methodology:** Inline narrowest `as` type assertions (proven Phase 7-16 approach)
**Success Criteria:** -2 to -3 errors, 100% test pass rate, 9.5+/10 review score

---

## Overview

Continue B2 TS18046 cleanup using proven inline cast methodology. Phase 16 completed with request-body HTTP boundary pattern on `usage/reconciliation/sync/route.ts` (-2 errors, 9.8/10). Phase 17 targets admin dunning routes or alternative response-body variants with similar quota system context.

---

## Backlog Candidates (Updated 2026-04-26 09:10)

### Recommended Batch: `admin/dunning/*` Routes (2 errors combined)

#### Candidate 1A: `src/app/api/admin/dunning/[licenseNonce]/restore/route.ts` (BATCH FIRST HALF)
- **Error Count:** 1 TS18046 instance
- **Type:** License dunning restoration handler
- **Protected Flow Risk:** Low — admin operation (non-customer-facing)
- **Estimated Effort:** 1-2 hours (batch with suspend route)
- **Pattern Match:** Similar to Phases 10-11 (response-body variant)
- **Recommendation:** Batch with suspend route as Phase 17 (-2 total)

#### Candidate 1B: `src/app/api/admin/dunning/[licenseNonce]/suspend/route.ts` (BATCH SECOND HALF)
- **Error Count:** 1 TS18046 instance
- **Type:** License dunning suspension handler
- **Protected Flow Risk:** Low — admin operation
- **Estimated Effort:** 1-2 hours (batch with restore route)
- **Pattern Match:** Similar to Phases 10-11
- **Recommendation:** Batch with restore route as Phase 17 (-2 total)

**Batch Rationale:** Two 1-error files = single Phase 17 (-2 errors). No scope creep. Both admin-protected, low risk. Follows Phase 13 pattern (single-endpoint, low error count).

---

### Alternative Single-Target Candidates (if batch deferred)

#### Candidate 2: `src/components/mcu-balance-widget.tsx` (Response Variant)
- **Error Count:** 3 TS18046 instances
- **Type:** MCU balance widget with HTTP boundary
- **Protected Flow Risk:** Low — internal dashboard UI
- **Estimated Effort:** 2-3 hours
- **Pattern Match:** Similar to Phases 9-10 (response-body variant)
- **Recommendation:** Alternative if dunning routes deferred. Component-based pattern.

#### Candidate 3: `src/components/raas/api-key-list.tsx` (Response Variant)
- **Error Count:** 3 TS18046 instances
- **Type:** RAAS API key list component
- **Protected Flow Risk:** Low — internal RAAS dashboard
- **Estimated Effort:** 2-3 hours
- **Pattern Match:** Similar to Phase 13 (single-endpoint HTTP boundary)
- **Recommendation:** Alternative response variant if mcu-balance deferred

#### Candidate 4: `src/components/raas/mission-launcher.tsx` (Response Variant)
- **Error Count:** 2 TS18046 instances
- **Type:** RAAS mission launcher component
- **Protected Flow Risk:** Low — internal UI
- **Estimated Effort:** 2-3 hours
- **Pattern Match:** Similar to Phase 13 (2-error target)
- **Recommendation:** Singleton alternative if dunning batch preferred. Lightweight pattern.

#### Candidate 5: `src/app/api/graphql/analytics/route.ts` (Response Variant)
- **Error Count:** 2 TS18046 instances
- **Type:** GraphQL analytics endpoint
- **Protected Flow Risk:** Medium — analytics query interface
- **Estimated Effort:** 2-3 hours
- **Pattern Match:** Similar to Phase 13 (2-error target, response-body)
- **Recommendation:** Lower priority than mcu-balance or mission-launcher. Analytics non-critical path.

---

### DEFER: High-Risk or Scope-Verify Candidates

#### DEFER: `src/app/api/webhooks/telegram/route.ts` (HIGH RISK)
- **Error Count:** 4 TS18046 instances
- **Type:** Telegram webhook payload handling (Protected Flow #2)
- **Protected Flow Risk:** ⚠️ HIGH — Telegram bot critical (@Sophia_Bbot)
- **Note:** Webhook signature verification, IPN idempotency checks required
- **Recommendation:** Requires specialized planning, extra code review, integration testing. Schedule for Phase 18+ with dedicated webhook testing plan.

#### DEFER: `src/app/api/admin/licenses/[id]/reactivate/route.ts` (Scope Verification)
- **Error Count:** 3 TS18046 instances
- **Type:** License reactivation API handler
- **Protected Flow Risk:** Medium — licensing core logic
- **Note:** Verify if payment-adjacent (Protected Flow #3). Requires scope confirmation before assignment.
- **Recommendation:** Confirm licensing scope with team lead before Phase 18 assignment.

---

### Long Tail Candidates (Single Error Each)

**Reserve for Phase 18+:**
- `roi-calculator.ts` (1 error)
- `violation-queries.ts` (1 error)
- `billing/usage-summary/route.ts` (1 error)
- `quota/overage-events/route.ts` (1 error)
- `mission-dashboard.tsx` (1 error)
- `mission-detail.tsx` (1 error)
- `license-generator.tsx` (1 error)

---

## Phase 17 Selection Criteria

**Priority Order:**
1. **`admin/dunning/*` Batch (2 errors)** ← RECOMMENDED for Phase 17 (START HERE)
2. `mcu-balance-widget.tsx` (3 errors, response variant alternative)
3. `raas/api-key-list.tsx` (3 errors, response variant alternative)
4. `raas/mission-launcher.tsx` (2 errors, singleton alternative)
5. `graphql/analytics/route.ts` (2 errors, lower priority)
6. `webhooks/telegram/route.ts` (4 errors, HIGH RISK — Phase 18+)
7. `licenses/[id]/reactivate/route.ts` (3 errors, scope verify — Phase 18+)

**Selection Rationale for Phase 17:**
- **Batch:** Two 1-error files = same effort as single 2-error file. Admin-protected (low risk). No scope creep.
- **Pattern Continuity:** Same request/response HTTP boundary cast pattern as Phases 13-16
- **Risk-to-Reward:** Lowest error count (2 total), proven pattern, immediate delivery
- **Cognitive Continuity:** Admin operations context (after quota system in Phases 12-16)

---

## Implementation Plan (Template for `admin/dunning/*` Batch)

### File 1: `admin/dunning/[licenseNonce]/restore/route.ts`

1. **Read file:** Understand restoration endpoint, dunning state transitions, API contract
2. **Analyze errors:** Identify 1 TS18046 error with exact line number
3. **Type analysis:** Determine if inline `as` is safe
4. **Draft change:** Apply narrowest scope cast (response-body or request-body variant)
5. **Local interface:** Create minimal interface (3-4 lines) for HTTP boundary

### File 2: `admin/dunning/[licenseNonce]/suspend/route.ts`

1. **Read file:** Understand suspension endpoint, dunning state machine
2. **Analyze errors:** Identify 1 TS18046 error with exact line number
3. **Type analysis:** Verify isolation from restore endpoint
4. **Draft change:** Apply same pattern (consistent across batch)
5. **Local interface:** Create minimal interface for this endpoint

### Joint Testing & Review

6. **Test:** `npm test` → verify 100% pass, focus on admin endpoints
7. **Review:** Code review for 9.5+/10 approval (batch treated as single atomic change)
8. **Commit:** Conventional format: `fix: Phase 17 TS18046 — admin/dunning restore+suspend (-2)`

**Expected Effort:** 2-3 hours total (batch)

---

## Success Criteria

- [ ] Phase 17 target batch identified: `admin/dunning/restore` + `admin/dunning/suspend`
- [ ] TS18046 errors reduced by 2 (28 → 26)
- [ ] Tests: 1394/1394 passing
- [ ] Code review: 9.5+/10 approved
- [ ] Commit: Conventional format, descriptive message
- [ ] Phase 18 backlog identified

---

## Quality Gates

- TypeScript: `npx tsc --noEmit` → 28 TS18046 baseline met
- Tests: `npm test` → 100% pass rate
- Review: >= 9.5/10 quality score
- Type Safety: All inline casts documented
- No protected flows affected (admin dunning non-customer-facing)

---

## Key Links

- **Plan Overview:** `plans/260425-2055-b2-typescript-cleanup/plan.md`
- **Phase 16 Reference:** `plans/260425-2055-b2-typescript-cleanup/phase-16-typescript-cleanup.md`
- **Phase 16 Tester Report:** `plans/reports/tester-260426-b2-phase16-usage-recon-sync.md`
- **Phase 16 Review Report:** `plans/reports/code-review-260426-0907-b2-phase16-usage-recon-sync.md`
- **Phase 13 Reference:** `plans/260425-2055-b2-typescript-cleanup/phase-13-typescript-cleanup.md` (single-endpoint pattern)
- **Tech Debt Tracker:** `plans/TECH_DEBT_TRACKING.md`

---

**Status:** Backlog candidates identified, Phase 17 ready for assignment
**Next Step:** Delegate Phase 17 implementation (recommend `admin/dunning/*` batch)
**Estimated Duration:** Phase 17 implementation ~2-3 hours
