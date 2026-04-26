# Phase 29: TypeScript Cleanup — TS2304 Quick-Win Completion

**Status:** ✅ COMPLETED 2026-04-26 12:45 UTC
**Scope:** 3 files (vi import + 2 campaign component IntlFormat fixes)  
**Baseline:** 280 errors (post-Phase 28)  
**Result:** 280 → 251 errors (-29: 28 TS2304 + 1 TS2307)  
**Priority:** COMPLETED (TS2304 eliminated, bonus latent bug fixed)

---

## Overview

Phase 29 **COMPLETED** — Quick-win TS2304 elimination (vi undefined + IntlFormat type fixes).

**Execution:** 3 files modified, 0 protected flows affected, 1398/1398 tests passing.

**Key Achievements:**
1. Fixed `src/test/setup.tsx` — explicit `import { vi } from 'vitest'` (preferred over tsconfig global type injection)
2. Fixed `src/app/[locale]/dashboard/campaigns/[id]/components/campaign-details-sidebar.tsx` — local `type IntlFormat` alias replacing broken import
3. Fixed `src/app/[locale]/dashboard/campaigns/[id]/components/campaign-header.tsx` — same IntlFormat pattern (eliminates latent bug: non-existent intl export)

**Error Reduction:**
- TS2304 (undefined names): 28 → 0 (vi ×27 + IntlFormat ×1)
- TS2307 (module not found): 1 → 0 (broken `intl` import)
- **Total:** 280 → 251 (-29 errors, 45.7% cumulative progress)

---

## Files Modified

### 1. src/test/setup.tsx

**Change:** Added `import { vi } from 'vitest'` at top of file  
**Why:** Explicit import superior to implicit global type injection — avoids hidden ambient side effects, makes test files self-documenting  
**Vitest Config:** `vitest.config.ts` has `globals: true`, so `vi` works at runtime; explicit import just makes TypeScript happy  
**Impact:** Fixes all 27 TS2304 errors in setup.tsx (vi.fn(), vi.mock(), vi.spyOn() calls)

### 2. src/app/[locale]/dashboard/campaigns/[id]/components/campaign-details-sidebar.tsx

**Change:** Replaced broken `import type { IntlFormat } from 'intl'` with local type alias:
```typescript
import type { getFormatter } from "next-intl/server"
type IntlFormat = Awaited<ReturnType<typeof getFormatter>>
```
**Why:** Canonical next-intl pattern; future-proof against version bumps; eliminates non-existent npm export  
**Impact:** Fixes TS2304 (IntlFormat undefined) + bonus TS2307 (intl module not found)

### 3. src/app/[locale]/dashboard/campaigns/[id]/components/campaign-header.tsx

**Change:** Same IntlFormat pattern as campaign-details-sidebar.tsx  
**Impact:** Fixes duplicate TS2304 + TS2307 errors in header component

---

## Test Results

**Full Suite:** 1398/1398 PASS (116 test files, 0 regressions)  
**Campaign Components:** 8 tests PASS (campaign-details-sidebar + campaign-header)  
**Vitest Setup:** 18 tests PASS (vi.fn(), vi.mock() mocks all working)  
**Build:** 0 TypeScript errors, Next.js build successful

---

## Pre-existing TS2307 Deferred

5 remaining TS2307 errors (module resolution issues, unrelated to Phase 29 scope):
- `@/components/ui/scroll-area` (1 error)
- `./commerce` (1 error)
- `./index` ×3 in worker/lib metering-reconciler

These require separate investigation. Recommend Phase 30 quick-scan to categorize.

---

## Code Review Findings

**Score:** 9.7/10 (AUTO-APPROVED, 0 critical / 0 major)

**Minor (Non-Blocking):** M1 — DRY opportunity: IntlFormat type alias duplicated across campaign-header + campaign-details-sidebar. Could extract to shared `src/types/intl.ts`, but YAGNI applies (only 2 files). If 3rd consumer emerges, extract then.

**Positive Observations:**
- Explicit vi import aligns with Sophia rule "no implicit globals"
- Bonus latent bug fix: campaign-header had non-existent intl export (pure noise, now removed)
- Type alias follows next-intl canonical pattern (future-proof)
- Zero behavioral change; type-only diff

---

## Phase 28 Review Carries (Deferred from Phase 28, still pending)

**Mi-1: JSDoc Clarification (Session-Trust Asymmetry)**
- File: `src/lib/auth/is-user-admin.ts`
- Effort: 15 minutes
- Status: Available for Phase 30+

**Mi-2: Unit Test Assertion Refinement**
- File: `src/lib/auth/__tests__/is-user-admin.test.ts`
- Effort: 20 minutes
- Status: Available for Phase 30+

**Mi-3: Tier Behavior Change Comment**
- File: `src/app/api/usage/export/post-handler.ts` near L68
- Effort: 10 minutes
- Status: Available for Phase 30+

---

## Carry-Forward Backlog (Deferred Phases 30+)

**Long-Term Carries:**
- 5 TS2339 in `heygen-client.ts` (DB row shape mismatches, ideal Phase 30 target)
- 72 remaining TS2339 errors (property mismatch audit TBD)
- `audit-log-table.tsx` > 200 LOC modularization (Phase 24 defer)
- User.role tightening (Phase 24 doctrine question)
- Structured error responses (P1)
- Subscription race window (P2)
- AuditLog camelCase mismatch (P3)
- Zod migration admin endpoints

---

## Success Criteria (Phase 29)

- [x] TS2304 errors eliminated (28 → 0)
- [x] TS2307 errors eliminated (1 → 0)
- [x] 3 files modified (0 protected flows affected)
- [x] Tests: 1398/1398 passing (zero regressions)
- [x] Code review: 9.7/10 auto-approved
- [x] Bonus latent bug fixed (campaign-header non-existent intl export)

---

## Related Links

- **Phase 28 Completion:** `phase-28-typescript-cleanup.md`
- **Tester Report:** `plans/reports/tester-260426-1245-b2-phase29-ts2304-quickwin.md`
- **Code Review Report:** `plans/reports/code-review-260426-1245-b2-phase29-ts2304-quickwin.md`
- **Tech Debt Tracker:** `plans/reports/TECH_DEBT_TRACKING.md`
- **Code Standards:** `docs/code-standards.md`

---

## Phase 30 Planning

**Candidates for Next Phase:**
1. **TS2339 Property Mismatch Audit** (72 remaining errors) — highest-frequency non-TS18046 type
   - Known targets: `heygen-client.ts` (5 errors), `violations-get-handler.ts` (3 errors), others TBD
   - Root causes: DB schema mismatches, HTTP response shapes, optional field semantics
2. **TS2307 Module Resolution (5 pre-existing)** — quick-scan categorization
3. **Phase 28 Review Carries (Mi-1/Mi-2/Mi-3)** — lightweight refinements

---

**Status:** ✅ COMPLETED  
**Priority:** HIGH (Quick-win executed; next phase Phase 30 targeting TS2339)  
**Timeline:** Phase 30 pending stakeholder prioritization  
**Notes:** Phase 29 TS2304 quick-win complete (-29 errors, 45.7% cumulative). 251 errors remaining (TS2339 ×72 + other types). Phase 30 recommended: TS2339 audit with known candidates (heygen-client, violations-get-handler).
