# Phase 36: TypeScript Cleanup — TS2339 + TS2322 Hard Targets

**Status:** 📋 READY FOR PLANNING (2026-04-26 post-Phase 35)  
**Baseline:** 148 errors (post-Phase 35)  
**Target:** TS2339 (25 remaining) + TS2322 (49 remaining) hard targets  
**Priority:** HIGH (TS2339 high-frequency patterns identified)  
**Estimated Effort:** 6-8 hours (depends on pattern batching strategy)

---

## Overview

Phase 36 targets remaining 148 errors after Phase 35's mass TS2352 elimination.

**Error Distribution:**
1. **TS2339** (25 remaining) — Property mismatches (high-frequency: HTTP boundaries, component props, DB schema)
2. **TS2322** (49 remaining) — Type assignment mismatches (DB schema + type assignment patterns)
3. **Other types** (74 remaining) — Distributed categories (TS2345, TS2307, TS2304, etc.)

**Phase 35 Carry-Forwards (Deferred Phase 36+):**

| Carry | Category | Scope | Effort | Priority | Status |
|-------|----------|-------|--------|----------|--------|
| M1 | getD1() helper DRY | 6+ sites using getD1() defensively cast | 1-1.5h | MEDIUM | Pending execution Phase 36+ |
| M2 | Chart payload alignment | ErrorRateChart payload narrower than UsageChart (cosmetic) | 0.5-1h | LOW | Pending execution Phase 36+ |

---

## TS2339 Candidates (25 errors — High Priority)

**High-Frequency Patterns Identified (Phase 34-35 analysis):**

| Rank | Pattern | Estimated Count | Files | Effort | Approach |
|------|---------|-----------------|-------|--------|----------|
| 1 | HTTP response-body cast (remaining) | 6-8 | TBD (scan) | 1.5-2h | Sub-Variant 1-4 batch |
| 2 | Component prop narrowing | 4-6 | TBD (scan) | 1-1.5h | Local interface cast |
| 3 | DB schema mismatch (non-D1) | 3-5 | TBD (scan) | 1-1.5h | Sub-Variant X (DB cast) |
| 4 | Misc singletons | 6-8 | TBD (scatter) | 1.5-2h | Pattern triage required |

**Recommended Phase 36 Approach:**
1. Grep for remaining TS2339 errors (batch by pattern)
2. Categorize by root cause (HTTP boundary, DB schema, component prop)
3. Execute Phase 36 batch targeting TS2339 × 25 (target: 25 → ≤ 5)

---

## TS2322 Candidates (49 errors — Medium Priority)

**Hypothesis:** DB schema + type assignment patterns similar to Phase 23 (internal query results).

**Phase 36+ Recommended Analysis:**
- Scan error locations for common patterns
- Identify if sister-file pattern exists (like Phase 23 internal/usage)
- Cluster by endpoint type (internal, public, admin)
- If Phase 36 TS2339 completes early, initiate Phase 36 batch 2 for TS2322 top candidates

**Estimated Phase 36 Effort:** 3-4 hours (if time permits batch 2)

---

## Execution Paths (Phase 36)

### Path A: TS2339 Comprehensive + M1/M2 Carries (Recommended)

1. **Pre-execution analysis (0.5h):**
   - Grep all remaining TS2339 errors
   - Cluster by pattern (HTTP boundary, DB schema, component prop)
   - Rank by frequency + effort

2. **Execute TS2339 batch (4-5h):**
   - HTTP response-body casts (Sub-Variant 1-4) — 1.5-2h
   - Component props (local interface cast) — 1-1.5h
   - DB schema variants (Sub-Variant X) — 1-1.5h
   - Misc singletons (pattern triage) — 1-1.5h

3. **M1/M2 carry-forwards (1-1.5h):**
   - Extract getD1() helper (DRY, 6+ sites)
   - Chart payload alignment (cosmetic)

**Result Target:** 148 → ~110-120 errors (25-30% Phase 36 reduction, 73-75% cumulative)

### Path B: TS2339 Fast-Track + TS2322 Pilot (Aggressive)

1. Focus TS2339 (25 errors only) — aggressive batching
2. Execute M1/M2 carries
3. If time permits: Identify TS2322 top patterns + execute 1-2 representative batches

**Result Target:** 148 → ~100-110 errors (30-35% Phase 36 reduction, 75-76% cumulative)

---

## Success Criteria (Phase 36)

- [ ] TS2339 errors reduced (25 → target ≤ 5)
- [ ] TS2322 top candidates identified and scored
- [ ] Root causes documented by error type + pattern
- [ ] Tests: 1398/1398 passing (zero regressions)
- [ ] Code review: >= 9.5/10
- [ ] M1 getD1() DRY extraction if time permits
- [ ] M2 chart payload alignment if time permits
- [ ] Phase 37 backlog documented (TS2322 batch + remaining TS2339)

---

## Related Links

- **Phase 35 Completion:** `phase-35-typescript-cleanup.md`
- **Plan Overview:** `plan.md`
- **Tech Debt Tracker:** `plans/reports/TECH_DEBT_TRACKING.md`
- **Phase 35 Tester Report:** `plans/reports/tester-260426-1352-b2-phase35-ts2352-batch.md`

---

**Status:** READY FOR ASSIGNMENT  
**Priority:** HIGH (TS2339 × 25 high-frequency patterns)  
**Timeline:** 2026-04-27+ (pending stakeholder prioritization)  
**Notes:** Phase 35 delivered 68% cumulative reduction (462 → 148). Phase 36 targets TS2339 × 25 (high-frequency HTTP boundaries + component props) + optional TS2322 × 49 (DB schema patterns). Pattern analysis required before execution. M1/M2 carry-forwards pending scope and timeline.
