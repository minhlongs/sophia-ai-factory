# Phase 35: TypeScript Cleanup — Remaining TS2339/TS2322/TS2352 Hard Targets

**Status:** 📋 READY FOR PLANNING (2026-04-26 post-Phase 34)  
**Baseline:** 189 errors (post-Phase 34)  
**Target:** TS2339/TS2322/TS2352 hard targets + carry-forward optimizations  
**Priority:** MEDIUM (mixed patterns, pattern analysis needed before execution)  
**Estimated Effort:** 5-7 hours (depends on pattern clustering)

---

## Overview

Phase 35 targets remaining 189 errors after Phase 34's agent-health D1 + chart TooltipProps batch.

**Error Distribution:**
1. **TS2339** (25 remaining) — Property mismatches (mixed patterns: DB schema, HTTP boundaries, component props)
2. **TS2322** (49 unchanged) — Type assignment mismatches (DB schema + type assignment patterns)
3. **TS2352** (38 remaining after Phase 34 -3) — Type-assertion validation issues
4. **Other types** (77 unchanged) — Distributed categories (TS2345, TS2307, TS2304, etc.)

---

## Phase 34 Carry-Forwards

**Minor Improvements Flagged (Phase 34 Review):**

| Carry | Category | Scope | Effort | Priority | Status |
|-------|----------|-------|--------|----------|--------|
| M1 | getD1() helper DRY | 6+ sites using getD1() defensively cast | 1-1.5h | MEDIUM | Pending pattern analysis |
| M2 | Chart payload alignment | ErrorRateChart payload narrower than UsageChart (cosmetic) | 0.5-1h | LOW | Cosmetic improvement |

---

## Remaining TS2339 Candidates (25 errors)

**High-Frequency Patterns Identified (Phase 34 analysis):**

| Rank | Pattern | Estimated Count | Files | Effort | Approach |
|------|---------|-----------------|-------|--------|----------|
| 1 | HTTP response-body cast (remaining) | 6-8 | TBD (scan) | 1.5-2h | Sub-Variant 1-4 batch |
| 2 | Component prop narrowing | 4-6 | TBD (scan) | 1-1.5h | Local interface cast |
| 3 | DB schema mismatch (non-D1) | 3-5 | TBD (scan) | 1-1.5h | Sub-Variant X (DB cast) |
| 4 | Misc singletons | 6-8 | TBD (scatter) | 1.5-2h | Pattern triage required |

**Recommended Approach:**
1. Grep for remaining TS2339 errors (batch by pattern)
2. Categorize by root cause (HTTP boundary, DB schema, component prop)
3. Execute Path A (comprehensive batch) or Path B (fast-track known patterns)

---

## TS2322 Deep-Dive (49 unchanged)

**Hypothesis:** DB schema + type assignment patterns similar to Phase 23 (internal query results).

**Recommended Pre-Phase Analysis:**
- Scan error locations for common patterns
- Identify if sister-file pattern exists (like Phase 23 internal/usage)
- Cluster by endpoint type (internal, public, admin)

**Estimated Effort:** 4-5 hours (batch by pattern)

---

## TS2352 Remaining (38 errors)

**Hypothesis:** Type assertion validation issues (possibly discriminated union patterns, array type guards).

**Recommended Pre-Phase Analysis:**
- Categorize by assertion type (`as T` vs `<T>` vs type guard)
- Identify if pattern repeats across files
- Flag "hard assertions" vs "soft assertions" (discriminated union safe vs risky)

**Estimated Effort:** 2-3 hours (mechanical cleanup + pattern validation)

---

## Execution Paths (Phase 35)

### Path A: Comprehensive Analysis + Full Batch (Recommended)

1. **Pre-execution analysis (0.5h):**
   - Grep all remaining TS2339/TS2322/TS2352 errors
   - Cluster by pattern (HTTP boundary, DB schema, component prop, assertion type)
   - Rank by frequency

2. **Execute batches by pattern (4-5h):**
   - TS2339 HTTP boundaries (Sub-Variant 1-4) — 1.5-2h
   - TS2339 component props (local interface cast) — 1-1.5h
   - TS2339 DB schema (Sub-Variant X) — 1-1.5h
   - TS2322 DB schema batch (Phase 23 pattern) — if time permits
   - TS2352 assertion cleanup (if time permits)

3. **M1/M2 carry-forwards (0.5-1h):**
   - Extract getD1() helper (DRY, 6+ sites)
   - Cosmetic chart payload alignment

**Result Target:** 189 → ~140-150 errors (26-30% Phase 35 reduction, 68-70% cumulative)

### Path B: TS2339 Only + Known Patterns (Fast-Track)

1. Focus TS2339 (25 errors only)
2. Skip TS2322/TS2352 analysis (defer Phase 36)
3. Target known patterns: HTTP boundaries, DB schema variants
4. Execute M1/M2 carry-forwards

**Result Target:** 189 → ~160 errors (15% Phase 35 reduction, 65% cumulative)

---

## Success Criteria (Phase 35)

- [ ] TS2339 errors reduced (25 → target ≤ 10)
- [ ] TS2322 top candidates identified and scored
- [ ] TS2352 candidates cataloged by assertion type
- [ ] Root causes documented by error type + pattern
- [ ] Tests: 1398/1398 passing (zero regressions)
- [ ] Code review: >= 9.5/10
- [ ] M1 getD1() DRY extraction if time permits
- [ ] M2 chart payload alignment if time permits

---

## Related Links

- **Phase 34 Completion:** `phase-34-typescript-cleanup.md`
- **Plan Overview:** `plan.md`
- **Tech Debt Tracker:** `plans/reports/TECH_DEBT_TRACKING.md`
- **Phase 34 Tester Report:** `plans/reports/tester-260426-1340-b2-phase34-ts2339-batch.md`
- **Phase 34 Code Review:** `plans/reports/code-review-260426-1340-b2-phase34-ts2339-batch.md`

---

**Status:** READY FOR ASSIGNMENT  
**Priority:** MEDIUM (189 remaining errors, harder targets)  
**Timeline:** 2026-04-27+ (pending pattern analysis + stakeholder prioritization)  
**Notes:** Phase 34 delivered 59.1% cumulative reduction (462 → 189). Phase 35 targets remaining 25 TS2339 + 49 TS2322 + 38 TS2352 + 77 other errors. Pattern analysis required before execution. M1/M2 carry-forwards pending scope.
