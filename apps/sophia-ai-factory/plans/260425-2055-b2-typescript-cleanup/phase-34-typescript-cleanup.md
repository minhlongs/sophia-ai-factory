# Phase 34: TypeScript Cleanup — Remaining TS2339/TS2322/TS2352 Deep Dive

**Status:** 📋 READY FOR PLANNING (2026-04-26)  
**Baseline:** 202 errors (post-Phase 33)  
**Target:** Continue TS2339/TS2322/TS2352 property + type assignment + type-assertion reduction  
**Priority:** HIGH (TS2339 ×35 > TS2322 ×49 > TS2352 ×41 by estimated effort)  
**Estimated Effort:** 4-6 hours (mixed complexity, pattern-based cleanup + carry-forwards)

---

## Overview

Phase 34 continues the TypeScript cleanup following Phase 33's 4-route Sub-Variant 2 batch. Remaining 202 errors consist of:

1. **TS2339** (35 remaining) — Property mismatches (API boundaries, DB results, optional field semantics)
2. **TS2322** (49 errors) — Type assignment mismatches (DB schema + type assignment patterns)
3. **TS2352** (41 errors) — Type-assertion validation issues
4. **Other types** (77 errors) — Distributed categories (TS2345, TS2307, TS2304, etc.)

---

## High-Frequency Candidates (Phase 33 Carve-Out)

**Remaining 35 TS2339 errors — Top Targets (Post-Phase 33):**

| Rank | Component | Error Count | Root Cause Hypothesis | Effort | Pattern |
|------|-----------|-------------|------------------------|--------|---------|
| 1 | `agent-health-resolver` | 3 | D1Client.prepare schema mismatch (different variant from Phase 33) | 1-1.5h | Sub-Variant X (DB schema) |
| 2 | Analytics charts (UsageChart, usage-chart, service-breakdown, ErrorRateChart) | 2 each (4+ files) | Chart data structure mismatch | 1-2h per file | HTTP boundary cast or interface update |
| 3 | Other singletons | 20+ | Various (mixed root causes) | 3-4h | Triage by pattern |

**TS2322 candidates (49 errors):**
- DB schema + type assignment patterns (Sub-Variant 4 candidates)
- Query result shape mismatches
- Estimated effort: 3-4 hours (batch by pattern)

**TS2352 candidates (41 errors):**
- Type-assertion validation
- Estimated effort: 2-3 hours (mechanical cleanup)

---

## Phase 33 Carries (Still Pending)

**Minor Refinements from Phase 31:**
- Mi-1: JSDoc clarification in `is-user-admin.ts` (session-trust asymmetry) — non-blocking
- Mi-2: Unit test assertion refinement in `is-user-admin.test.ts` — non-blocking
- Mi-3: Tier behavior change comment in `usage/export/post-handler.ts` — non-blocking

**Modularization Flags:**
- MIN-1: `smart-resume-engine.ts` is 205 LOC (over 200 guideline) — split into engine + in-memory-checkpoint-store modules (Phase 34+)
- M2: Orphan `LicenseAlertPanel` component — flag for dead-code sweep
- M3: Duplicate `Env` interfaces in `worker/lib/` — DRY consolidation

---

## Phase 34 Execution Paths

### Path A: TS2339 Complete + TS2322 Start (Recommended)

1. Target all remaining 35 TS2339 errors (agent-health-resolver ×3, analytics charts ×8, other singletons ×24)
2. Identify patterns:
   - DB schema mismatches (Sub-Variant X pattern)
   - API response boundaries (Sub-Variant 2-4 patterns)
   - Optional field semantics
3. Batch by pattern and apply fixes
4. **Estimated effort:** 3-4 hours
5. Start TS2322 candidates if time permits

**Result target:** 202 → ~150 errors (25% reduction, 61% cumulative)

### Path B: Known Candidates First (Fast Track)

1. Fix `agent-health-resolver` (3 TS2339, D1Client.prepare variant)
   - Analyze health metric schema
   - Apply defensive cast pattern if needed
   - **Estimated:** 1-1.5 hours

2. Fix analytics charts (4+ files, 2 errors each)
   - Audit chart data structure vs interface
   - Apply cast pattern or interface update
   - **Estimated:** 2-3 hours

3. Fix remaining TS2339 + start TS2322 (20+ TS2339 + 49 TS2322)
   - Triage and batch by pattern
   - Apply fixes
   - **Estimated:** 2-3 hours

**Result target:** 202 → ~130 errors (35% reduction, 72% cumulative)

---

## Success Criteria (Phase 34)

- [ ] TS2339 errors reduced (35 → target ≤ 15)
- [ ] TS2322 errors evaluated and top candidates identified
- [ ] TS2352 candidates cataloged
- [ ] Root causes documented by error type
- [ ] Tests: 1398/1398 passing (zero regressions)
- [ ] Code review: >= 9.5/10
- [ ] Phase 31 minor carries addressed (Mi-1/Mi-2/Mi-3) if time permits
- [ ] MIN-1 modularization (smart-resume-engine) if scope permits

---

## Related Links

- **Phase 33 Completion:** `phase-33-typescript-cleanup.md`
- **Phase 32 Completion:** `phase-32-typescript-cleanup.md`
- **Tech Debt Tracker:** `plans/reports/TECH_DEBT_TRACKING.md`
- **Code Standards:** `docs/code-standards.md`
- **Development Rules:** `.claude/rules/development-rules.md`

---

**Status:** READY FOR ASSIGNMENT  
**Priority:** HIGH (202 remaining errors, target Phase 34)  
**Timeline:** 2026-04-27+ (pending stakeholder prioritization)  
**Notes:** Phase 33 eliminated 14 TS2339 errors (4-route Sub-Variant 2 batch). Phase 34 targets remaining 35 TS2339 + 49 TS2322 + 41 TS2352 errors. Paths A (comprehensive) and B (fast-track) available. Phase 31 carries (Mi-1/Mi-2/Mi-3) available for lightweight refinement. Modularization flag (smart-resume-engine) escalated from Phase 32+ for possible Phase 34 inclusion.
