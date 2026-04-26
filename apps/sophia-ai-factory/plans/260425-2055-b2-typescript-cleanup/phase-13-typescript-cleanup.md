# Phase 13: TypeScript TS18046 Cleanup (Backlog Ready)

**Status:** Scoped | Candidate Selection Pending
**Target Errors:** 37 TS18046 remaining (current baseline)
**Methodology:** Inline narrowest `as` type assertions (proven Phase 7-12 approach)
**Success Criteria:** -2 to -4 errors, 100% test pass rate, 9.5+/10 review score

---

## Overview

Continue B2 TS18046 cleanup using proven inline cast methodology. Phase 12 completed with dual-endpoint HTTP boundary pattern on `quota-usage-dashboard.tsx` (-3 errors). Phase 13 will target next highest-concentration file from identified backlog.

---

## Backlog Candidates (Updated 2026-04-26)

### Candidate 1: `src/components/referral/referral-share-widget.tsx` (RECOMMENDED FIRST)
- **Error Count:** 2 TS18046 instances
- **Type:** Component-level widget state/prop alignment
- **Protected Flow Risk:** None — UI widget for referral sharing
- **Estimated Effort:** 2-3 hours
- **Pattern Match:** Similar to Phase 11-12 (component prop alignment)
- **Recommendation:** START HERE — lowest error count, safest target, no protected flows

### Candidate 2: `src/app/api/coupons/apply/route.ts` (Extra Caution Required)
- **Error Count:** 3 TS18046 instances
- **Type:** API request/response payload handling
- **Protected Flow Risk:** Medium — coupon application logic (not in primary 3 protected flows, but affects pricing/discount)
- **Note:** Can proceed after Phase 13 if Phase 13 completes smoothly
- **Requirement:** Extra code review + integration testing before merge

### Candidate 3: `src/app/api/licenses/[id]/reactivate/route.ts` (Check If Licensing Protected)
- **Error Count:** 3 TS18046 instances
- **Type:** License reactivation API handler
- **Protected Flow Risk:** Medium — licensing core logic (may be payment-adjacent)
- **Note:** Verify before assigning if licensing is part of protected flow
- **Requirement:** Confirm licensing scope with team lead before proceeding

### Candidate 4: `src/app/api/webhooks/telegram/route.ts` (DEFER TO PHASE 14+)
- **Error Count:** 4 TS18046 instances
- **Type:** Webhook payload handling
- **Protected Flow Risk:** ⚠️ HIGH — Telegram bot critical flow (protected flow #2)
- **Note:** DEFER — requires webhook integration test strategy + signature verification review
- **Requirement:** Extra code review + integration testing + rollback plan

---

## Phase 13 Selection Criteria

**Priority Order:**
1. **`referral-share-widget.tsx`** ← RECOMMENDED for Phase 13
2. `coupons/apply/route.ts` (candidate for Phase 13+ — medium risk, verify scope)
3. `licenses/[id]/reactivate/route.ts` (candidate for Phase 13+ — verify if licensing protected)
4. `telegram/route.ts` (candidate for Phase 14+ — high risk, requires specialized testing)

**Selection Rationale:**
- Lowest error count (2 vs 3-4)
- High safety profile (no protected flows)
- Clear component-level scope (props/state types)
- Proven pattern from Phases 6-12 applies directly
- Safe for rapid iteration

---

## Implementation Plan (Template)

### For `referral-share-widget.tsx` Target:

1. **Read file:** Understand widget props, state structure, sharing types
2. **Analyze errors:** List all 2 TS18046 errors with exact line numbers
3. **Type analysis:** Determine if inline `as` is safe (each error targets distinct shape)
4. **Draft changes:** Apply narrowest scope casts
5. **Test:** `npm test -- src/components/referral` → verify 100% pass
6. **Review:** Code review for 9.5+/10 approval
7. **Commit:** Conventional format

**Expected Effort:** 2-3 hours total

---

## Success Criteria

- [ ] Phase 13 target file implemented
- [ ] TS18046 errors reduced by 2-3 (37 → 34-35)
- [ ] Tests: 1394/1394 passing
- [ ] Code review: 9.5+/10 approved
- [ ] Commit: Conventional format, descriptive message
- [ ] Phase 14 backlog identified

---

## Quality Gates

- TypeScript: `npx tsc --noEmit` → 37 TS18046 baseline met
- Tests: `npm test` → 100% pass rate
- Review: >= 9.5/10 quality score
- Type Safety: All inline casts documented
- No protected flows affected

---

## Key Links

- **Plan Overview:** `plans/260425-2055-b2-typescript-cleanup/plan.md`
- **Phase 12 Reference:** `plans/260425-2055-b2-typescript-cleanup/phase-12-typescript-cleanup.md`
- **Phase 12 Tester Report:** `plans/reports/tester-260426-0821-b2-phase12-quota-dashboard.md`
- **Phase 12 Review Report:** `plans/reports/code-review-260426-0821-b2-phase12-quota-dashboard.md`
- **Tech Debt Tracker:** `plans/TECH_DEBT_TRACKING.md`

---

## Open Questions Carried Forward

From Phase 12 review and earlier phases:

1. **Missing `/api/quota/status` Route** — Identified during Phase 12 code review. `GETStatus` export in `overage-events/route.ts` L69 is dead code. Dashboard fetch returns 404 → error UI. Pre-existing bug, file separate ticket. Not Phase 12's scope but should be resolved before production release.

2. **AuditLog Row-Shape camelCase/snake_case Mismatch** — Identified during Phase 11 code review. Client expects `nonce`/`timestamp` but server emits `license_nonce`/`created_at`. Pre-existing bug, recommend smoke-test on `/admin/licenses` audit tab before filing follow-up ticket.

3. **HTTP Boundary Type Cast Pattern Formalization** — Phase 6/8/9/10/11/12 all use identical pattern (local interface + cast at boundary + `??` fallbacks). 6 consistent instances (Phase 12 first dual-endpoint) justify formal documentation. Recommend updating `docs/code-standards.md` § "HTTP Boundary Type Cast" with code template and note: "First dual-endpoint application in Phase 12; separate interfaces per endpoint, no merged god-type."

4. **462-vs-37 Baseline Discrepancy** — Initial tracker recorded 462 baseline errors. Post-Phase 8: 51. Post-Phase 10: 43. Post-Phase 12: 37. Continue using current measurement as baseline.

5. **Defensive Fallbacks YAGNI Debate** — Phase 10 noted `?? 'pending'` fallback patterns. Consensus: Keep fallbacks for API boundary stability. Phase 11-12 confirmed this as canonical choice. Defer defensive refactoring unless customer issues arise.

---

**Status:** Backlog candidates identified, Phase 13 ready for assignment
**Next Step:** Delegate Phase 13 implementation (recommend `referral-share-widget.tsx`)
**Estimated Duration:** Phase 13 implementation ~2-3 hours
