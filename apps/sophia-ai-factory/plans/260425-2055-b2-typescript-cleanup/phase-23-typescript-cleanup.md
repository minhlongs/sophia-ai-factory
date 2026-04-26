# Phase 23: TypeScript Cleanup — Sister File Bundle

**Status:** 🔄 READY FOR ASSIGNMENT (2026-04-26)  
**Estimated Duration:** 2-3 hours  
**Scope:** 2 files (internal/usage/query + usage/summary routes)  
**Target:** 5 TS18046 errors  
**Expected Results:** -5 errors (336 → 331), 1394/1394 tests, ~9.6/10 review

---

## Overview

Phase 23 targets two sister files with identical `single<T>()` generic constraint antipattern. Identified via Phase 22 code review. Both files use HTTP boundary casts with single-endpoint scope (Sub-Variant 4 pattern). Low risk — internal API endpoints with no protected flow impact.

---

## Files to Target

### File 1: `src/app/api/internal/usage/query/route.ts`

**Current State:**
- 3 TS18046 errors
- Lines with `as unknown` antipattern: ~3 sites
- Type: HTTP response-body boundary cast (single-endpoint)
- Scope: Internal usage analytics endpoint

**Implementation Plan:**
1. Create local `UsageQueryResponse` interface capturing response shape
2. Apply single cast at HTTP boundary: `(await response.json()) as UsageQueryResponse`
3. Verify cascading TS2558/TS2339 resolution
4. Test (should be 0 regressions)

**Sister Pattern Reference:** Phase 22 `raas-invoice-generator.ts` (identical scope + scale)

---

### File 2: `src/app/api/usage/summary/route.ts`

**Current State:**
- 2 TS18046 errors
- Type: HTTP request-body + response-body boundary casts
- Defensive variant: `.catch()` on `request.json()`
- Scope: Public usage summary endpoint (no authentication required)

**Implementation Plan:**
1. Create local `UsageSummaryRequest` interface for request-body
2. Create local `UsageSummaryResponse` interface for response-body
3. Apply dual casts: `(await request.json()) as UsageSummaryRequest`
4. Defensive fallback: `.catch(() => ({}))`
5. Test (expect 0 regressions)

**Sister Pattern Reference:** Phase 16-17 defensive `.catch()` pattern

---

## Success Criteria

- [x] 5 TS18046 errors identified
- [ ] File 1: Interface created + cast applied
- [ ] File 2: Dual interfaces + defensive pattern applied
- [ ] Tests: 1394/1394 passing (0 regressions)
- [ ] Code review: >= 9.5/10 (expect 9.6-9.8)
- [ ] Cascading errors resolved (TS2558/TS2339)
- [ ] No protected flow impact

---

## Related Links

- **Phase 22 Report:** `plans/260425-2055-b2-typescript-cleanup/phase-22-typescript-cleanup.md`
- **Phase 22 Sister File Discovery:** Code review section
- **Tech Debt Tracker:** `plans/reports/TECH_DEBT_TRACKING.md`
- **Implementation Reference:** Phase 22 raas-invoice-generator.ts pattern

---

## Next Phase: Phase 24 Preview

**Expected Scope After Phase 23:**
- Remaining errors: 1 (telegram protected flow, requires test plan)
- Optional carries: 2-3 (dead code, dormant features, documentation)
- Decision items: Telegram webhook strategy, GETStatus export, Polar lifecycle

See plan.md Phase 24 skeleton after Phase 23 completion.

---

**Assignment:** Ready for delegation  
**Priority:** HIGH (final stretch to 99.3%+ completion)  
**Timeline:** 2026-04-27 estimated start
