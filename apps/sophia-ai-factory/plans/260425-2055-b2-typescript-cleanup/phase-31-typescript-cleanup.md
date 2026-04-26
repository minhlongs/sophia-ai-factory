# Phase 31: TypeScript Cleanup — TS2339 Property Mismatch Audit

**Status:** 📋 PLANNING (2026-04-26)  
**Baseline:** 246 errors (post-Phase 30)  
**Scope:** TS2339 property mismatch root-cause audit (72 instances, highest remaining)  
**Priority:** HIGH (most common non-TS18046/non-QueryError/non-TS2304/non-TS2307 type)  
**Estimated Effort:** 4-6 hours (mixed complexity per file)

---

## Overview

Phase 31 focuses on TS2339 property mismatch errors — the highest-frequency remaining error type (72 instances). Root-cause analysis requires case-by-case investigation to determine:

1. **DB row shape mismatches** — Cloudflare D1/Supabase query results don't match local interfaces
2. **Schema evolution gaps** — Migration changes not reflected in type interfaces
3. **Optional field bugs** — Using required fields as optional or vice versa
4. **HTTP response boundaries** — External API responses not matching local interfaces
5. **Cast boundary patterns** — Similar to HTTP boundary anti-corruption (Phase 8-30 patterns)

---

## High-Frequency TS2339 Candidates (Preliminary)

| Rank | File | Error Count | Suspected Root Cause | Effort |
|------|------|-------------|----------------------|--------|
| 1 | `src/lib/heygen/heygen-client.ts` | 5 | HTTP response shape (HeyGen API schema mismatch) | 1.5-2h |
| 2 | `src/app/admin/violations/violations-get-handler.ts` | 3 | DB row interface mismatch + unmigrated logger L38 | 1-1.5h |
| 3-5 | (Others TBD via error categorization) | 64 | Mixed: schema evolution + optional semantics | 3-4h |

**Action Required:** Run `npx tsc --noEmit 2>&1 | grep "TS2339" | head -20` to identify top targets.

---

## Phase 30 Inherited Context & Carries

**Phase 30 Discoveries:**
- M1 (Phase 30 review): Install shadcn ScrollArea if UX polish needed (license-alert-panel)
- M2 (Phase 30 review): Orphan `LicenseAlertPanel` component (zero consumers) — flag for dead-code sweep
- M3 (Phase 30 review): Duplicate `Env` interfaces in `worker/lib/auth-middleware.ts` L18 + `worker/lib/quota-counter.ts` L8 — DRY consolidation candidates

**Phase 28-29 Review Carries (Still Pending):**
- Mi-1: JSDoc clarification in `is-user-admin.ts` (session-trust asymmetry)
- Mi-2: Unit test assertion refinement in `is-user-admin.test.ts`
- Mi-3: Tier behavior change comment in `usage/export/post-handler.ts`

**Remain in Phase 31+ Scope (No Action Phase 30):**
- 5 TS2339 in `heygen-client.ts` (DB row shape mismatches)
- 1 unmigrated logger site `violations-get-handler.ts` (Phase 28 carry)
- User.role tightening (Phase 24)
- audit-log-table.tsx >200 LOC modularization
- Structured error responses (P1)
- Subscription race window
- AuditLog camelCase mismatch
- Zod migration admin endpoints
- Polar/Stripe lifecycle (product input)
- Mi-2: Phase 29 vitest/globals tsconfig carry (if vitest @ts-ignore remains)

---

## Phase 31 Execution Paths

### Path A: Top-Down Breakdown (Recommended)

1. Run error categorization: `npx tsc --noEmit 2>&1 | grep "TS2339" | awk -F'(' '{print $1}' | sort | uniq -c | sort -rn | head -10`
2. Target top 5-10 highest-frequency files
3. For each file:
   - Analyze error context (component lifecycle, API boundary, DB query)
   - Identify root cause (schema mismatch, optional semantics, cast needed)
   - Apply minimal fix: interface update, optional marker, or type alias
   - Reuse HTTP boundary anti-corruption patterns from Phase 8-30 if applicable
4. Iterate until 72 → X (target ≤ 20 for Phase 32)

**Estimated effort:** 4-5 hours (mix of 1-3 errors per file, varying complexity)

### Path B: Known Candidates First (Fast Track)

1. Fix `heygen-client.ts` (5 errors, HTTP response shape)
   - Analyze HeyGen API documentation for response structure
   - Apply HTTP boundary cast pattern (Sub-Variant 4, familiar from Phase 8-30)
   - **Estimated:** 1.5-2 hours
2. Fix `violations-get-handler.ts` (3 errors, DB row shape L38)
   - Audit L38 DB query vs interface
   - Apply DB schema fix or cast pattern
   - **Estimated:** 1-1.5 hours
3. Audit remaining 64 errors via automated categorization
   - Group by file frequency
   - Target next batch (12-20 errors) for Phase 31 completion
   - **Estimated:** 2-3 hours

**Estimated effort:** 4-6 hours (fast wins + incremental cleanup)

---

## Success Criteria (Phase 31)

- [ ] TS2339 errors categorized and root causes documented
- [ ] Top 5-10 high-frequency files targeted
- [ ] Known candidates fixed (`heygen-client.ts` ×5, `violations-get-handler.ts` ×3)
- [ ] Property mismatch fixes implemented (72 → X, target ≤ 20 remaining)
- [ ] Tests: 1398/1398 passing (zero regressions)
- [ ] Code review: >= 9.5/10
- [ ] Phase 28-30 minor carries addressed (Mi-1/Mi-2/Mi-3 + M1/M2/M3) if time permits

---

## Related Links

- **Phase 30 Completion:** `phase-30-typescript-cleanup.md`
- **Phase 29 Completion:** `phase-29-typescript-cleanup.md`
- **Tech Debt Tracker:** `plans/reports/TECH_DEBT_TRACKING.md`
- **Code Standards:** `docs/code-standards.md`
- **Development Rules:** `.claude/rules/development-rules.md`

---

**Status:** READY FOR ASSIGNMENT  
**Priority:** HIGH (72 TS2339 errors, highest non-TS18046/non-QueryError/non-TS2304/non-TS2307 frequency)  
**Timeline:** 2026-04-27+ (pending stakeholder prioritization)  
**Notes:** Phase 30 TS2307 quick-win complete. Phase 31 targets TS2339 property mismatch cleanup. Paths A (breakdown) and B (known-candidates) available. Known candidates: heygen-client.ts (5), violations-get-handler.ts (3), others TBD via automated categorization.
