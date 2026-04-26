# Phase 9: TypeScript TS18046 Cleanup (Backlog Ready)

**Status:** Scoped | Ready for Implementation
**Target Errors:** 51 TS18046 remaining (current state)
**Methodology:** Inline narrowest `as` type assertions (proven Phase 7-8 approach)
**Success Criteria:** -4 errors, 100% test pass rate, 9.5+/10 review score

---

## Overview

Continue B2 TS18046 cleanup using proven inline cast methodology. Phase 8 completed with HTTP boundary pattern on `heygen-client.ts` (-4 errors). Phase 9 will target next highest-concentration file from identified backlog.

---

## Backlog Candidates

### Candidate 1: `src/components/raas/api-key-create-modal.tsx` (Recommended for later)
- **Error Count:** 4 TS18046 instances
- **Type:** Component-level type mismatches
- **Protected Flow Risk:** None
- **Estimated Effort:** 3-4 hours

### Candidate 2: `src/app/[locale]/dashboard/proposals/page.tsx` (Recommended FIRST)
- **Error Count:** 4 TS18046 instances
- **Type:** Form/table data type alignment
- **Protected Flow Risk:** None — standard dashboard page
- **Pattern Match:** Similar to Phase 8 (API boundary handling)
- **Estimated Effort:** 4-6 hours
- **Recommendation:** START HERE — safest, most similar to Phase 8 pattern

### Candidate 3: `src/app/api/webhooks/telegram/route.ts` (Extra Caution Required)
- **Error Count:** 4 TS18046 instances
- **Type:** Webhook payload handling
- **Protected Flow Risk:** ⚠️ HIGH — Telegram bot critical flow
- **Note:** DO NOT target until Phase 9 candidate complete (defer to Phase 10)
- **Requirement:** Extra code review + integration testing before merge

---

## Phase 9 Selection Criteria

**Priority Order:**
1. **`proposals/page.tsx`** ← RECOMMENDED for Phase 9
2. `api-key-create-modal.tsx` (candidate for Phase 10)
3. `telegram/route.ts` (candidate for Phase 11+ — requires extra testing)

**Selection Rationale:**
- Highest safety profile (no protected flows)
- Similar pattern to Phase 8 (proven methodology applies)
- Zero risk of breaking client-facing features
- Safe for rapid iteration

---

## Implementation Plan (Template)

### For `proposals/page.tsx` Target:

1. **Read file:** Understand page structure, data sources, error contexts
2. **Analyze errors:** List all 4 TS18046 errors with exact line numbers
3. **Type analysis:** Determine if inline `as` is safe (each error targets distinct shape)
4. **Draft changes:** Apply narrowest scope casts
5. **Test:** `npm test -- src/app/*/dashboard/proposals` → verify 100% pass
6. **Review:** Code review for 9.5+/10 approval
7. **Commit:** Conventional format

**Expected Effort:** 4-6 hours total

---

## Success Criteria

- [ ] Phase 9 target file implemented (`proposals/page.tsx`)
- [ ] TS18046 errors reduced by 4 (51 → 47)
- [ ] Tests: 1394/1394 passing
- [ ] Code review: 9.5+/10 approved
- [ ] Commit: Conventional format, descriptive message
- [ ] Phase 10 backlog identified

---

## Quality Gates

- TypeScript: `npx tsc --noEmit` → 51 TS18046 baseline met
- Tests: `npm test` → 100% pass rate
- Review: >= 9.5/10 quality score
- Type Safety: All inline casts documented
- No protected flows affected

---

## Key Links

- **Plan Overview:** `plans/260425-2055-b2-typescript-cleanup/plan.md`
- **Phase 8 Reference:** `plans/260425-2055-b2-typescript-cleanup/phase-08-typescript-cleanup.md`
- **Tech Debt Tracker:** `plans/TECH_DEBT_TRACKING.md`
- **Phase 7 Tester Report:** `plans/reports/tester-260426-0030-b2-phase7-rate-limit-wrapper.md`

---

**Status:** Backlog candidates identified, ready for assignment
**Next Step:** Select `proposals/page.tsx` as Phase 9 target, delegate implementation
**Estimated Duration:** Phase 9 implementation ~4-6 hours
