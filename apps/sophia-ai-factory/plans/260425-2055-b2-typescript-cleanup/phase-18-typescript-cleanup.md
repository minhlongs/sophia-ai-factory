# Phase 18: TypeScript TS18046 Cleanup (Backlog Ready)

**Status:** Pending | Candidate Selection Ready  
**Target Errors:** 26 TS18046 remaining (Phase 17 baseline)  
**Methodology:** Inline narrowest `as` type assertions (proven Phase 7-17 approach)  
**Success Criteria:** -3 to -4 errors, 100% test pass rate, 9.5+/10 review score  

---

## Overview

Continue B2 TS18046 cleanup using proven HTTP boundary cast methodology. Phase 17 completed with defensive `.catch()` extension on admin dunning routes (BATCH, -2 errors, 9.8/10). Phase 18 targets internal dashboard components or alternative request-body patterns with higher error counts than Phase 17.

---

## Backlog Candidates (Updated 2026-04-26 09:15)

### Tier 1: Recommended Primary Candidates (LOW RISK, HIGH IMPACT)

#### Candidate 1A: `src/components/mcu-balance-widget.tsx` (RESPONSE VARIANT #8)
- **Error Count:** 3 TS18046 instances
- **Type:** MCU balance widget with HTTP boundary
- **Protected Flow Risk:** Low — internal dashboard UI
- **Estimated Effort:** 2-3 hours
- **Pattern Match:** HTTP boundary response-body cast (Instance #8)
- **Previous Reference:** Phase 9-10 (dashboard components), Phase 12 (dual-endpoint pattern)
- **Recommendation:** PRIMARY for Phase 18 (start here)
- **Context:** Widget fetches MCU balance from internal API; three distinct response shapes suggest local interface strategy

#### Candidate 1B: `src/components/raas/api-key-list.tsx` (RESPONSE VARIANT #9)
- **Error Count:** 3 TS18046 instances
- **Type:** RAAS API key list component
- **Protected Flow Risk:** Low — internal RAAS dashboard
- **Estimated Effort:** 2-3 hours
- **Pattern Match:** HTTP boundary response-body cast (Instance #9)
- **Previous Reference:** Phase 13 (single-endpoint pattern)
- **Recommendation:** ALTERNATIVE if mcu-balance deferred; or sequential after mcu-balance
- **Context:** API key listing endpoint; similar single-endpoint pattern to Phase 13

---

### Tier 2: Secondary Candidates (LOW RISK, MEDIUM EFFORT)

#### Candidate 2A: `src/components/raas/mission-launcher.tsx` (RESPONSE VARIANT #10)
- **Error Count:** 2 TS18046 instances
- **Type:** RAAS mission launcher component
- **Protected Flow Risk:** Low — internal UI
- **Estimated Effort:** 2-3 hours
- **Pattern Match:** Similar to Phase 13 (2-error target, response-body)
- **Recommendation:** Singleton alternative if dual-candidate approach deferred
- **Context:** Mission launch flow; typically single endpoint fetch

#### Candidate 2B: `src/app/api/graphql/analytics/route.ts` (RESPONSE VARIANT #11)
- **Error Count:** 2 TS18046 instances
- **Type:** GraphQL analytics endpoint
- **Protected Flow Risk:** Medium — analytics query interface
- **Estimated Effort:** 2-3 hours
- **Pattern Match:** HTTP boundary response-body cast (Instance #11, GraphQL-specific)
- **Recommendation:** Lower priority than mcu-balance or mission-launcher (analytics non-critical path)
- **Context:** GraphQL endpoint; may require schema-aware cast (more complex than REST variants)

---

### Tier 3: Scope-Verification Candidates (DEFER TO PHASE 18 MID-REVIEW)

#### Candidate 3A: `src/app/api/admin/licenses/[id]/reactivate/route.ts` (REQUEST-BODY VARIANT #6)
- **Error Count:** 3 TS18046 instances
- **Type:** License reactivation API handler
- **Protected Flow Risk:** Medium — licensing core logic
- **Estimated Effort:** 2-3 hours
- **Pattern Match:** HTTP boundary request-body cast (Instance #6, admin variant)
- **Recommendation:** VERIFY SCOPE FIRST — confirm if payment-adjacent (Protected Flow #3)
- **Note:** Licensing may interact with tier activation / payment flows; requires team lead approval before assignment
- **Deferred Action:** Confirm with team lead that reactivation logic is NOT payment-sensitive before proceeding

---

### Tier 4: HIGH RISK / PROTECTED FLOW CANDIDATES (SCHEDULE PHASE 18+)

#### DEFER: `src/app/api/webhooks/telegram/route.ts` (REQUEST-BODY VARIANT #7, PROTECTED FLOW #2)
- **Error Count:** 4 TS18046 instances
- **Type:** Telegram webhook payload handling
- **Protected Flow Risk:** ⚠️ **HIGH** — Telegram bot critical (@Sophia_Bbot)
- **Estimated Effort:** 3-4 hours (requires webhook testing plan)
- **Pattern Match:** HTTP boundary request-body cast (Instance #7, webhook-specific)
- **Recommendation:** Schedule for Phase 18+ with dedicated webhook testing infrastructure
- **Required Planning:** Webhook signature verification, IPN idempotency checks, test Telegram bot integration end-to-end
- **Note:** Same effort as 3-error target but higher risk; recommend after Phase 18 single-target completion

---

### Tier 5: Long-Tail Candidates (PHASE 19+)

Single-error files reserved for Phase 19+:
- `roi-calculator.ts` (1 error)
- `violation-queries.ts` (1 error)
- `billing/usage-summary/route.ts` (1 error)
- `quota/overage-events/route.ts` (1 error)
- `mission-dashboard.tsx` (1 error)
- `mission-detail.tsx` (1 error)
- `license-generator.tsx` (1 error)

---

## Phase 18 Selection Criteria

**Priority Order (Recommended Sequence):**

1. **Candidate 1A: `mcu-balance-widget.tsx` (3 errors)** ← RECOMMENDED FOR PHASE 18 START
2. Alternative: Candidate 1B: `raas/api-key-list.tsx` (3 errors, if portfolio diversity preferred)
3. Candidate 2A: `raas/mission-launcher.tsx` (2 errors, singleton alternative)
4. Candidate 2B: `graphql/analytics/route.ts` (2 errors, lower priority)
5. Candidate 3A: `admin/licenses/[id]/reactivate/route.ts` (3 errors, SCOPE VERIFY FIRST)
6. DEFER: `webhooks/telegram/route.ts` (4 errors, Phase 18+ with webhook testing plan)

**Selection Rationale for Phase 18:**
- **Primary (mcu-balance-widget):** Dashboard component, low risk, response-body pattern matches Phases 9-12. Direct continuation of proven pattern.
- **Batch Option:** mcu-balance (3) + mission-launcher (2) = 5-error Phase 18. Similar to Phase 12 (dual-endpoint, 3 errors). Higher impact, same methodology.
- **Risk-to-Reward:** All Tier 1-2 candidates safe for immediate assignment. No protected flows. Test coverage established (dashboard/RAAS components).

---

## Implementation Plan (Template for `mcu-balance-widget.tsx`)

### Step 1: Analyze Current Errors
```bash
npx tsc --noEmit 2>&1 | grep -E "mcu-balance-widget.*TS18046"
# Expected: 3 errors, likely on response.json() boundary
```

### Step 2: Understand Component Structure
- Read file header → identify data fetching pattern
- Locate HTTP call(s) → determine response shape
- Identify state setters → understand expected data structure
- Note: Three distinct errors suggest multiple endpoints or complex response variants

### Step 3: Design Local Interfaces
- One local interface per HTTP boundary (or per response variant)
- YAGNI principle: include only consumed fields
- Optional fields (`?:`) for nullable responses
- Example:
  ```typescript
  interface MCUBalanceResponse {
    balance: number;
    lastUpdated?: string;
    tier?: string;
  }
  ```

### Step 4: Apply Inline Casts
- Cast at narrowest scope: `(await res.json()) as MCUBalanceResponse`
- Add defensive fallbacks: `?? 0` for numeric, `?? null` for objects
- Preserve error handling: no `.catch()` needed if endpoint reliable (unlike admin routes)

### Step 5: Verify Test Coverage
- Run `npm test` → expect 1394/1394 pass
- Zero regressions expected (casting doesn't change runtime behavior)

### Step 6: Code Review
- Expect 9.5+/10 baseline (pattern instance #8, response-body variant)
- 2-3 hrs implementation + review + commit

---

## Success Criteria

- [ ] Phase 18 target selected and confirmed
- [ ] TS18046 errors reduced by 3-4 (26 → 22-23)
- [ ] Tests: 1394/1394 passing
- [ ] Code review: 9.5+/10 approved
- [ ] Commit: Conventional format, descriptive message
- [ ] Phase 19 backlog identified

---

## Quality Gates

- TypeScript: `npx tsc --noEmit` → 26 TS18046 baseline met
- Tests: `npm test` → 100% pass rate
- Review: >= 9.5/10 quality score
- Type Safety: All inline casts documented
- No protected flows affected (dashboard/RAAS internal operations)

---

## Key Links

- **Plan Overview:** `plans/260425-2055-b2-typescript-cleanup/plan.md`
- **Phase 17 Reference:** `plans/260425-2055-b2-typescript-cleanup/phase-17-typescript-cleanup.md`
- **Phase 17 Tester Report:** `plans/reports/tester-260426-b2-phase17-admin-dunning-routes.md`
- **Phase 12 Reference (Dual-Endpoint Pattern):** `plans/260425-2055-b2-typescript-cleanup/phase-12-typescript-cleanup.md`
- **Phase 13 Reference (Single-Endpoint Pattern):** `plans/260425-2055-b2-typescript-cleanup/phase-13-typescript-cleanup.md`
- **Tech Debt Tracker:** `plans/reports/TECH_DEBT_TRACKING.md`

---

**Status:** Backlog candidates identified, Phase 18 ready for assignment  
**Next Step:** Delegate Phase 18 implementation (recommend `mcu-balance-widget.tsx` primary or batch combination)  
**Estimated Duration:** Phase 18 implementation ~2-4 hours (3-4 errors)  

---

## Unresolved Questions

1. Should Phase 18 target single 3-error file (`mcu-balance-widget.tsx`) or dual-file batch combining 3-error + 2-error candidates (`mcu-balance + mission-launcher` = 5 errors)? Batch would match Phase 12 composite strategy.
2. For `admin/licenses/[id]/reactivate/route.ts`, should team lead pre-approve scope before assignment, or can Phase 18 reviewer determine safety on the fly?
3. Should `webhooks/telegram/route.ts` (4 errors, high-risk) be deferred to dedicated Phase 18b with specialized webhook testing plan, or tackled sequentially after Phase 18 completes?
