# Phase 23: TypeScript Cleanup — Sister File Bundle

**Status:** ✅ COMPLETED (2026-04-26 11:07 UTC)  
**Actual Duration:** ~2 hours  
**Scope:** 2 files (internal/usage/query + usage/summary routes)  
**Target:** 5 TS18046 errors  
**Actual Results:** -16 errors (336 → 320, including cascading TS2558/TS2322/TS2345/TS2339), 1394/1394 tests, 9.7/10 review

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
- [x] File 1: Interface created + cast applied (3 local interfaces, 4 cast sites)
- [x] File 2: Dual interfaces + defensive pattern applied (2 local interfaces, 2 cast sites)
- [x] Tests: 1394/1394 passing (0 regressions)
- [x] Code review: 9.7/10 auto-approved
- [x] Cascading errors resolved (TS2558 ×5, TS2322 ×8, TS2345 ×2, TS2339 ×1)
- [x] No protected flow impact (verified via tester report)

---

## Related Links

- **Phase 22 Report:** `plans/260425-2055-b2-typescript-cleanup/phase-22-typescript-cleanup.md`
- **Phase 22 Sister File Discovery:** Code review section
- **Tech Debt Tracker:** `plans/reports/TECH_DEBT_TRACKING.md`
- **Implementation Reference:** Phase 22 raas-invoice-generator.ts pattern

---

## Completion Summary

### Phase 23 Implementation Details

**File 1: `src/app/api/internal/usage/query/route.ts` (223 lines)**
- Added 3 local interfaces: `CustomerLicenseRow`, `NonceLicenseRow`, `RawUsageEventRow`
- Applied Sub-Variant 4 cast pattern at 4 sites (lines 129, 137, 157, 174)
- Added `toError()` wrapper for logger consistency (line 177)
- Removed 3 unsupported generic arguments to `single<T>()`
- Zero TypeScript errors in modified file

**File 2: `src/app/api/usage/summary/route.ts` (185 lines)**
- Added 2 local interfaces: `UserProfileRoleRow`, `LicenseOwnerRow`
- Applied Sub-Variant 4 cast pattern at 2 sites (lines 79, 91)
- Fixed `user_metadata` access pattern post-Better-Auth migration (line 81)
- Removed 2 unsupported generic arguments to `single<T>()`
- Zero TypeScript errors in modified file

### Error Reduction Breakdown

| Category | Count | Impact |
|----------|-------|--------|
| TS18046 fixed | 5 | Direct sister-file errors eliminated |
| TS2558 cascading | 5 | Fixed via Sub-Variant 4 casts |
| TS2322 cascading | 8 | Type assignment resolved |
| TS2345 cascading | 2 | Argument type fixed |
| TS2339 cascading | 1 | Property undefined resolved |
| **Total Reduction** | **16** | 336 → 320 (-4.8%) |

### Test & Review Results

- **Tests:** 1394/1394 passing (0 regressions)
- **Code Review:** 9.7/10 auto-approved
- **i18n Validation:** 760 t() calls, 0 missing keys
- **Auth Flows:** All verified (Better Auth, Supabase admin, X-Internal-Secret)
- **Protected Flows:** Setup Wizard ✅, Telegram Bot ✅, NOWPayments ✅

See `plans/reports/tester-260426-1107-b2-phase23-sister-cleanup.md` for full verification.

---

## Next Phase: Phase 24 Preview

**Remaining Scope After Phase 23:**
- **Critical:** 4 TS18046 in `webhooks/telegram/route.ts` (protected flow — requires test plan)
- **Optional:** 3 carries (dead code, dormant features, documentation)
- **Decision Items:** Telegram webhook strategy, GETStatus export, Polar lifecycle, user_metadata standardization

See plan.md Phase 24 skeleton for details.

---

**Completion Date:** 2026-04-26 11:07 UTC  
**Priority:** HIGH (final stretch to 99.4%+ completion)  
**Next Steps:** Await Phase 24 assignment (telegram test plan approval required)
