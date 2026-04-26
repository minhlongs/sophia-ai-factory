# Phase 12: TypeScript TS18046 Cleanup (Backlog Ready)

**Status:** Scoped | Candidate Selection Pending
**Target Errors:** 40 TS18046 remaining (current baseline)
**Methodology:** Inline narrowest `as` type assertions (proven Phase 7-11 approach)
**Success Criteria:** -3 to -4 errors, 100% test pass rate, 9.5+/10 review score

---

## Overview

Continue B2 TS18046 cleanup using proven inline cast methodology. Phase 11 completed with HTTP boundary pattern on `audit-log-table.tsx` (-3 errors). Phase 12 will target next highest-concentration file from identified backlog.

---

## Backlog Candidates (Updated 2026-04-26)

### Candidate 1: `src/components/quota/quota-usage-dashboard.tsx` (RECOMMENDED FIRST)
- **Error Count:** 3 TS18046 instances
- **Type:** Component-level dashboard data type alignment
- **Protected Flow Risk:** None — internal dashboard component
- **Estimated Effort:** 3-4 hours
- **Pattern Match:** Similar to Phase 11 (component prop alignment)
- **Recommendation:** START HERE — safest next target, low risk, no protected flows

### Candidate 2: `src/app/api/coupons/apply/route.ts` (Extra Caution Required)
- **Error Count:** 3 TS18046 instances
- **Type:** API request/response payload handling
- **Protected Flow Risk:** Medium — coupon application logic (not in primary 3 protected flows, but affects pricing/discount)
- **Note:** Can proceed after Phase 12 if Phase 12 completes smoothly
- **Requirement:** Extra code review + integration testing before merge

### Candidate 3: `src/app/api/licenses/[id]/reactivate/route.ts` (Check If Licensing Protected)
- **Error Count:** 3 TS18046 instances
- **Type:** License reactivation API handler
- **Protected Flow Risk:** Medium — licensing core logic (may be payment-adjacent)
- **Note:** Verify before assigning if licensing is part of protected flow
- **Requirement:** Confirm licensing scope with team lead before proceeding

### Candidate 4: `src/app/api/webhooks/telegram/route.ts` (DEFER TO PHASE 13+)
- **Error Count:** 4 TS18046 instances
- **Type:** Webhook payload handling
- **Protected Flow Risk:** ⚠️ HIGH — Telegram bot critical flow (protected flow #2)
- **Note:** DEFER — requires webhook integration test strategy + signature verification review
- **Requirement:** Extra code review + integration testing + rollback plan

### Candidate 5: `src/components/referral/referral-share-widget.tsx` (Also Low Risk)
- **Error Count:** 2 TS18046 instances
- **Type:** Component-level widget state/prop alignment
- **Protected Flow Risk:** None — UI widget for referral sharing
- **Estimated Effort:** 2-3 hours
- **Note:** Lower error count but still safe; could batch with another if time permits

---

## Phase 12 Selection Criteria

**Priority Order:**
1. **`quota-usage-dashboard.tsx`** ← RECOMMENDED for Phase 12
2. `referral-share-widget.tsx` (alternative, lower error count)
3. `apply/route.ts` (candidate for Phase 12+ — medium risk, verify scope)
4. `licenses/[id]/reactivate/route.ts` (candidate for Phase 12+ — verify if licensing protected)
5. `telegram/route.ts` (candidate for Phase 13+ — high risk, requires specialized testing)

**Selection Rationale:**
- High safety profile (no protected flows)
- Clear component-level scope (props/state types)
- Proven pattern from Phases 6-11 applies directly
- Safe for rapid iteration

---

## Implementation Plan (Template)

### For `quota-usage-dashboard.tsx` Target:

1. **Read file:** Understand dashboard props, data sources, visualization types
2. **Analyze errors:** List all 3 TS18046 errors with exact line numbers
3. **Type analysis:** Determine if inline `as` is safe (each error targets distinct shape)
4. **Draft changes:** Apply narrowest scope casts
5. **Test:** `npm test -- src/components` → verify 100% pass
6. **Review:** Code review for 9.5+/10 approval
7. **Commit:** Conventional format

**Expected Effort:** 3-4 hours total

---

## Success Criteria

- [ ] Phase 12 target file implemented
- [ ] TS18046 errors reduced by 3-4 (40 → 36-37)
- [ ] Tests: 1394/1394 passing
- [ ] Code review: 9.5+/10 approved
- [ ] Commit: Conventional format, descriptive message
- [ ] Phase 13 backlog identified

---

## Quality Gates

- TypeScript: `npx tsc --noEmit` → 40 TS18046 baseline met
- Tests: `npm test` → 100% pass rate
- Review: >= 9.5/10 quality score
- Type Safety: All inline casts documented
- No protected flows affected

---

## Key Links

- **Plan Overview:** `plans/260425-2055-b2-typescript-cleanup/plan.md`
- **Phase 11 Reference:** `plans/260425-2055-b2-typescript-cleanup/phase-11-typescript-cleanup.md`
- **Phase 11 Tester Report:** `plans/reports/tester-260426-b2-phase11-audit-log-table.md`
- **Phase 11 Review Report:** `plans/reports/code-review-260426-b2-phase11-audit-log-table.md`
- **Tech Debt Tracker:** `plans/TECH_DEBT_TRACKING.md`

---

## Open Questions Carried Forward

From Phase 11 review and earlier phases:

1. **AuditLog row-shape camelCase/snake_case mismatch** — Identified during Phase 11 code review. Client expects `nonce`/`timestamp` but server emits `license_nonce`/`created_at`. Pre-existing bug, filed as follow-up ticket. Recommendation: smoke-test on `/admin/licenses` audit tab before filing.

2. **HTTP Boundary Type Cast Pattern Formalization** — Phase 6/8/9/10/11 all use identical pattern (local interface + cast at boundary + `??` fallbacks). 5 consistent instances justify formal documentation. Recommend promoting from ad-hoc convention to documented standard in `docs/code-standards.md` § "HTTP Boundary Type Cast" with code template.

3. **File Size Modularization (Deferred)** — `audit-log-table.tsx` is 255 lines (exceeds 200-line guideline). Phase 11 added 5 lines (interface). Pre-existing issue, filed as separate ticket. Recommend extracting `AuditLogsTableRow`, `AuditLogsPagination`, `AuditLogsCsvExport`.

4. **462-vs-43 Baseline Discrepancy** — Initial tracker recorded 462 baseline errors. Actual count post-Phase 8 was 51. Post-Phase 10 = 43. Post-Phase 11 = 40. Continue using current measurement as baseline.

5. **Defensive Fallbacks YAGNI Debate** — Phase 10 noted `?? 'pending'` fallback patterns. Consensus: Keep fallbacks for API boundary stability. Phase 11 confirmed this as canonical choice. Defer defensive refactoring unless customer issues arise.

---

**Status:** Backlog candidates identified, Phase 12 ready for assignment
**Next Step:** Delegate Phase 12 implementation (recommend `quota-usage-dashboard.tsx`)
**Estimated Duration:** Phase 12 implementation ~3-4 hours
