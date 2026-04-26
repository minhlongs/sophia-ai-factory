# Phase 33: TypeScript Cleanup — TS2339 Deep Dive Continuation

**Status:** 📋 READY FOR PLANNING (2026-04-26)  
**Baseline:** 216 errors (post-Phase 32)  
**Target:** Continue TS2339 property mismatch reduction + TS2322/TS2352 candidates  
**Priority:** HIGH (49 TS2339 remaining > 49 TS2322 > 41 TS2352 by frequency)  
**Estimated Effort:** 3-5 hours (mixed complexity, pattern-based cleanup)

---

## Overview

Phase 33 continues the TS2339 deep-dive following Phase 32's smart-resume runtime bug fix + alerts route casts. Remaining 49 TS2339 errors represent genuine property shape mismatches that require:

1. **API response boundaries** — External API shape mismatch with local interfaces
2. **DB result mismatches** — Query results don't align with expected shape
3. **Optional field semantics** — Using required fields as optional or vice versa
4. **Component prop drilling** — Missing or incorrectly named props
5. **Cast boundary patterns** — HTTP boundary anti-corruption (Sub-Variants 2-4)

---

## High-Frequency TS2339 Candidates (Phase 32 Carve-Out)

**Remaining 49 TS2339 errors — Top Targets (Post-Phase 32):**

| Rank | Component | Error Count | Root Cause Hypothesis | Effort | Files |
|------|-----------|-------------|------------------------|--------|-------|
| 1 | `errors/report` | 5 | Error telemetry shape mismatch | 1-1.5h | 1-2 |
| 2 | `analytics/export` | 4 | Export data structure mismatch | 1-1.5h | 1-2 |
| 3 | `agent-health-resolver` | 3 | Health metric schema mismatch | 1-2h | 1 |
| 4 | `setup/verify` | 3 | Setup response shape mismatch | 1-2h | 1 |
| 5 | Analytics charts (UsageChart, usage-chart, service-breakdown, ErrorRateChart) | 2 each | Chart data structure mismatch | 1-1.5h each | 4 |
| 6-10 | Other files | 20+ | Various (mixed root causes) | 2-3h | TBD |

**Action Required:** Run `npx tsc --noEmit 2>&1 | grep "TS2339" | head -30` to identify top targets + root causes.

---

## Phase 31 Carries (Still Pending)

**Minor Refinements from Phase 31:**
- Mi-1: JSDoc clarification in `is-user-admin.ts` (session-trust asymmetry) — non-blocking
- Mi-2: Unit test assertion refinement in `is-user-admin.test.ts` — non-blocking
- Mi-3: Tier behavior change comment in `usage/export/post-handler.ts` — non-blocking

**Future Modularization Flags:**
- MIN-1: `smart-resume-engine.ts` is 205 LOC (over 200 guideline) — split into engine + in-memory-checkpoint-store modules (Phase 33+)
- MIN-2: `audit-log-table.tsx` >200 LOC — modularization candidate
- M2: Orphan `LicenseAlertPanel` component — flag for dead-code sweep
- M3: Duplicate `Env` interfaces in `worker/lib/` — DRY consolidation

---

## Phase 33 Execution Paths

### Path A: Top-Down High-Frequency Breakdown (Recommended)

1. Target top 5 highest-frequency files (errors/report, analytics/export, agent-health-resolver, setup/verify, analytics charts)
2. For each file:
   - Analyze error context (API boundary, DB query, response shape)
   - Identify root cause (schema mismatch, optional semantics, missing cast)
   - Apply minimal fix: interface update, optional marker, or Sub-Variant cast
   - Reuse HTTP boundary anti-corruption patterns from Phase 8-32 if applicable
3. Iterate until 49 → X (target ≤ 20 for Phase 34)

**Estimated effort:** 3-4 hours (mix of 1-3 errors per file, varying complexity)

### Path B: Known Candidates First (Fast Track)

1. Fix `errors/report` (5 errors, telemetry shape)
   - Analyze error response type vs local interface
   - Apply HTTP boundary cast pattern if needed
   - **Estimated:** 1-1.5 hours

2. Fix `analytics/export` (4 errors, export data structure)
   - Audit schema changes vs interface
   - Apply cast pattern or interface update
   - **Estimated:** 1-1.5 hours

3. Fix remaining candidates (agent-health-resolver, setup/verify, analytics charts = 20+ errors)
   - Triage and batch by pattern
   - Apply fixes
   - **Estimated:** 2-3 hours

**Estimated effort:** 3-5 hours (known fast wins + incremental cleanup)

---

## Phase 32 Review Carries & Flags

**Phase 32 Code Review (9.7/10):**
- MIN-1 (Non-blocking): `smart-resume-engine.ts` = 205 LOC (slightly over 200 guideline)
  - Recommend: Split into `engine.ts` + `in-memory-checkpoint-store.ts` in future modularization pass
  - Priority: LOW (correctness already delivered, code quality improvement only)

**Phase 32 Tester Verification:**
- All protected flows untouched (Setup Wizard, Telegram Bot, NOWPayments)
- i18n validation passed (760 t() calls, 349 unique keys, 0 missing)
- Smart resume checkpoint persistence now correctly awaits Supabase client

---

## Success Criteria (Phase 33)

- [ ] TS2339 errors categorized and top 10 files identified
- [ ] High-frequency candidates (errors/report, analytics/export, agent-health-resolver, setup/verify, charts) targeted
- [ ] Root causes documented (schema mismatch vs optional semantics vs cast needed)
- [ ] Property mismatch fixes implemented (49 → X, target ≤ 20 remaining)
- [ ] Tests: 1398/1398 passing (zero regressions)
- [ ] Code review: >= 9.5/10
- [ ] Phase 31 minor carries addressed (Mi-1/Mi-2/Mi-3) if time permits

---

## Related Links

- **Phase 32 Completion:** `phase-32-typescript-cleanup.md`
- **Phase 31 Completion:** `phase-31-typescript-cleanup.md`
- **Tech Debt Tracker:** `plans/reports/TECH_DEBT_TRACKING.md`
- **Code Standards:** `docs/code-standards.md`
- **Development Rules:** `.claude/rules/development-rules.md`

---

**Status:** READY FOR ASSIGNMENT  
**Priority:** HIGH (49 TS2339 errors, target Phase 33)  
**Timeline:** 2026-04-27+ (pending stakeholder prioritization)  
**Notes:** Phase 32 eliminated 12 TS2339 errors (smart-resume async fix + alerts routes). Phase 33 targets remaining 49 property mismatches. Paths A (breakdown) and B (known-candidates) available. Top candidates: errors/report (5), analytics/export (4), agent-health-resolver (3), setup/verify (3), analytics charts (2 each).
