# Phase 24: TypeScript Cleanup — Hygiene Cleanup Batch

**Status:** ✅ COMPLETED (2026-04-26)  
**Actual Duration:** ~2.5 hours  
**Scope:** Hygiene cleanup batch (NOT primary error elimination)  
**Target:** Remove dead code, standardize user_metadata access, add inline docs  
**Results:** 9 files modified, 320 → 318 (-2 TS18046), TS18046 unchanged at 4 (deferred to Phase 25)

---

## Overview

**EXECUTION PATH B:** Phase 24 executed optional hygiene cleanup (Path B from Phase 24 decision tree) instead of Path A (telegram protected flow). Scope reframed from "telegram-only assessment" to **"hygiene cleanup batch"** addressing carry-forwards from Phases 12, 22, 23.

**Decision Rationale:** Telegram protected flow deferred to Phase 25 pending stakeholder test plan approval. Phase 24 focused on removing blockers: dead code audit, standardization, and documentation.

---

## Execution Summary: Hygiene Cleanup (Path B)

**Files Modified:** 9 total  
**Execution Time:** ~2.5 hours  
**Result:** 320 → 318 remaining TS18046 (-2 side-effect elimination)  
**Pattern:** Dead code removal + standardization + documentation

### Group A: user_metadata Fallback Cleanup (6 sites)

**Scope:** Replace dead `user_metadata?.role` fallback with direct `user.role` access  
**Files Modified:**
1. `src/app/api/billing/dunning/[licenseNonce]/notify/route.ts` (used in email)
2. `src/app/api/billing/dunning/[licenseNonce]/handle-status/route.ts` (used in status handler)
3. `src/app/api/billing/dunning/[licenseNonce]/hook/route.ts` (used in webhook)
4. `src/app/api/usage-export/route.ts` (2 sites: header + export summary)
5. `src/app/api/usage/summary/route.ts` (1 site: auth check)

**Rationale:** Better Auth `User` type already has `role` field; `user_metadata` access was pre-Better-Auth migration dead code. Consolidates user shape post-migration.

### Group B: Dead Code Removal (1 file)

**File:** `src/app/api/quota/overage-events/route.ts` L75  
**Action:** Deleted unreachable `GETStatus` export (~50 LOC)  
**Impact:** Removes orphaned export from Phase 12 carry-forward  
**Cleanup:** 1 dead interface + 2 orphaned imports removed

### Group C: Inline Documentation (3 comments added)

**File 1:** `src/lib/raas/raas-invoice-generator.ts` (2 comments)  
- L130+: Documented double-cast rationale (Phase 22 carry, Stripe/Polar lifecycle decision)
- Explains why invoice amount cast twice (external type → internal type → DB insert)

**File 2:** `src/app/api/usage-export/route.ts` (1 comment)  
- Documented RawUsageEventRow interface link (Phase 23 carry)
- Cross-references phase report for cast pattern justification

---

## Newly Flagged Issues (Phase 25+ Backlog)

### M1 Carry: `/api/quota/status` Orphan Bug

**File:** `src/components/quota/quota-usage-dashboard.tsx:100`  
**Issue:** Component calls non-existent `/api/quota/status` endpoint (404 bug, pre-existing)  
**Options:**
1. Inline quota status fetch into `overage-events` endpoint
2. Create new `/api/quota/status/route.ts` with response shape contract
3. Research if endpoint was deprecated during Phase 12 refactor

**Effort:** 2-3 hours (investigation + fix)  
**Priority:** M1 (medium, internal dashboard only)

### M2 Carry: DRY Refactor — `isUserAdmin()` Helper

**Scope:** Extract admin role check across 6 sites (dunning routes, quota ops, licenses, usage-export)  
**Current Pattern:** `user.role === 'admin'` or `user_metadata?.role === 'admin'` checks duplicated  
**Action:** Create `src/lib/auth-helpers.ts` with `isUserAdmin(user: User): boolean`  
**Effort:** 1-2 hours (extract + test + consolidate)  
**Priority:** M2 (refactor, improves maintainability)

### M2 Doctrine Question: `User.role?: string` Tightening

**Context:** Better Auth User type has optional `role` field  
**Question:** Is runtime always guaranteed to populate `role` for authenticated users?  
**If Yes:** Change to `User.role: string` (non-optional) — removes 6 optional checks  
**If No:** Keep optional, add explicit null guards  
**Effort:** 30-60 minutes (research + decision)  
**Priority:** M2 (type safety improvement)

### M3 Carry: Sub-Variant 4 Documentation

**File:** `docs/code-standards.md`  
**Task:** Formalize DB-result cast pattern from Phases 20-23  
**Effort:** 1-2 hours  
**Scope:** Pattern synthesis + 7 instance examples from tester/code-review reports

---

## Success Criteria

**Hygiene Cleanup (Path B — EXECUTED):**
- [x] Group A: user_metadata fallback removed (6 sites)
- [x] Group B: Dead code removed (GETStatus ~50 LOC)
- [x] Group C: Inline documentation added (3 comments)
- [x] Code review: 9.7/10 auto-approved
- [x] Tests: 1394/1394 passing
- [x] TS18046: 320 → 318 (-2 side-effect elimination)
- [x] TS18046 (telegram): 4 unchanged (deferred Phase 25+)

**Phase 25 Prep (Deferred):**
- [ ] Telegram test plan documentation (stakeholder approval required)
- [ ] M1 `/api/quota/status` orphan bug fix
- [ ] M2 `isUserAdmin()` helper extraction
- [ ] M2 `User.role` optional → non-optional decision

---

## Phase 24 Decision Tree (EXECUTED: PATH B)

**EXECUTED: Path B — Hygiene Cleanup**
- Rationale: Telegram test plan not approved; Phase 24 focused on removing blockers
- Scope: Dead code removal, standardization, documentation
- Result: 320 → 318 remaining (-2 side-effect), TS18046 (telegram) deferred
- Timeline: ~2.5 hours (completed 2026-04-26 11:24 UTC)

**Phase 25 Path (UPCOMING):**
- Primary: Telegram protected flow (requires test plan approval first)
- Secondary: M1/M2 bug fixes + refactoring carries
- Tertiary: Sub-Variant 4 documentation task

---

## Related Links

- **Phase 23 Completion:** `phase-23-typescript-cleanup.md`
- **Phase 24 Tester Report:** `plans/reports/tester-260426-1124-phase24-b2-execution-summary.md`
- **Phase 24 Code Review:** `plans/reports/code-review-260426-1124-b2-phase24-hygiene-cleanup.md`
- **Tech Debt Tracker:** `plans/reports/TECH_DEBT_TRACKING.md`
- **Phase 25 Preview:** `phase-25-typescript-cleanup.md` (skeleton)

---

**Status:** AWAITING APPROVAL  
**Priority:** CRITICAL (final visible TS18046 stretch)  
**Timeline:** 2026-04-27+ (pending telegram test plan)  
**Blocker:** Webhook integration test strategy required
