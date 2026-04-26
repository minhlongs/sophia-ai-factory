# Phase 37: TypeScript Cleanup — TS2339 + TS2322 Remaining Batch

**Status:** 📋 READY FOR PLANNING (2026-04-26 post-Phase 36)  
**Baseline:** 123 errors (post-Phase 36)  
**Target:** TS2339 (25 remaining) + TS2322 (27 remaining) hard targets  
**Priority:** HIGH (TS2339 high-frequency patterns identified)  
**Estimated Effort:** 6-8 hours (depends on pattern batching strategy)

---

## Overview

Phase 37 targets remaining 123 errors after Phase 36's TS2322 batch.

**Error Distribution:**
1. **TS2339** (25 remaining) — Property mismatches (high-frequency: HTTP boundaries, component props, DB schema)
2. **TS2322** (27 remaining) — Type assignment mismatches (reduced from 49 via Phase 36, 22 eliminated + 3 cascading)
3. **Other types** (71 remaining) — Distributed categories (TS2345, TS2307, TS2304, etc.)

**Phase 36 Carry-Forwards (Deferred Phase 37+):**

| Carry | Category | Scope | Effort | Priority | Status |
|-------|----------|-------|--------|----------|--------|
| M1 | Local type consolidation | `UsageEventSyncRow` + `QuotaLimitsRow` duplicate canonical types — consider `Pick<>` consolidation | 0.5-1h | MEDIUM | Pending execution Phase 37+ |
| M2 | Nullability narrowing | Narrowed nullability in local types — widen or coalesce at assignment | 0.5-1h | MEDIUM | Pending execution Phase 37+ |
| M3 | Cosmetic alignment | `endpoint` property asymmetry alignment | 0.25-0.5h | LOW | Pending execution Phase 37+ |

---

## TS2339 Candidates (25 errors — High Priority)

**High-Frequency Patterns Identified (Phase 34-36 analysis):**

| Rank | Pattern | Estimated Count | Files | Effort | Approach |
|------|---------|-----------------|-------|--------|----------|
| 1 | HTTP response-body cast (remaining) | 6-8 | TBD (scan) | 1.5-2h | Sub-Variant 1-4 batch |
| 2 | Component prop narrowing | 4-6 | TBD (scan) | 1-1.5h | Local interface cast |
| 3 | DB schema mismatch (non-D1) | 3-5 | TBD (scan) | 1-1.5h | Sub-Variant X (DB cast) |
| 4 | Misc singletons | 6-8 | TBD (scatter) | 1.5-2h | Pattern triage required |

**Recommended Phase 37 Approach:**
1. Grep for remaining TS2339 errors (batch by pattern)
2. Categorize by root cause (HTTP boundary, DB schema, component prop)
3. Execute Phase 37 batch targeting TS2339 × 25 (target: 25 → ≤ 5)

---

## TS2322 Candidates (27 errors — Medium Priority)

**Phase 36 Update:** 49 → 27 errors (22 eliminated + 3 cascading side-effects).

**Hypothesis:** Remaining DB schema + type assignment patterns similar to Phase 23/36 patterns.

**Phase 37+ Recommended Analysis:**
- Scan error locations for common patterns in remaining 27 errors
- Identify if additional sister-file pattern exists (like Phase 23/36)
- Cluster by endpoint type (internal, public, admin)
- If Phase 37 TS2339 completes early, initiate Phase 37 batch 2 for TS2322 remaining targets

**Estimated Phase 37 Effort:** 3-4 hours (if time permits batch 2)

---

## Execution Paths (Phase 37)

### Path A: TS2339 Comprehensive + M1/M2/M3 Carries (Recommended)

1. **Pre-execution analysis (0.5h):**
   - Grep all remaining TS2339 errors
   - Cluster by pattern (HTTP boundary, DB schema, component prop)
   - Rank by frequency + effort

2. **Execute TS2339 batch (4-5h):**
   - HTTP response-body casts (Sub-Variant 1-4) — 1.5-2h
   - Component props (local interface cast) — 1-1.5h
   - DB schema variants (Sub-Variant X) — 1-1.5h
   - Misc singletons (pattern triage) — 1-1.5h

3. **M1/M2/M3 carry-forwards (1-1.5h):**
   - Local type consolidation: `UsageEventSyncRow` + `QuotaLimitsRow` `Pick<>` pattern
   - Nullability narrowing: widen or coalesce at assignment
   - Cosmetic alignment: `endpoint` property asymmetry

**Result Target:** 123 → ~90-100 errors (25-30% Phase 37 reduction, 76-80% cumulative)

### Path B: TS2339 Fast-Track + TS2322 Pilot (Aggressive)

1. Focus TS2339 (25 errors only) — aggressive batching
2. Execute M1/M2/M3 carries
3. If time permits: Identify TS2322 remaining patterns + execute 1-2 representative batches

**Result Target:** 123 → ~80-90 errors (30-35% Phase 37 reduction, 80-82% cumulative)

---

## Success Criteria (Phase 37)

- [ ] TS2339 errors reduced (25 → target ≤ 5)
- [ ] TS2322 remaining candidates identified and scored (27 → target ≤ 15)
- [ ] Root causes documented by error type + pattern
- [ ] Tests: 1398/1398 passing (zero regressions)
- [ ] Code review: >= 9.5/10
- [ ] M1 local type consolidation if time permits
- [ ] M2 nullability narrowing if time permits
- [ ] M3 cosmetic alignment if time permits
- [ ] Phase 38 backlog documented (TS2322 batch + remaining TS2339)

---

## Related Links

- **Phase 36 Completion:** `phase-36-typescript-cleanup.md`
- **Plan Overview:** `plan.md`
- **Tech Debt Tracker:** `plans/reports/TECH_DEBT_TRACKING.md`
- **Phase 36 Tester Report:** `plans/reports/tester-260426-1410-b2-phase36-ts2322-batch.md`

---

**Status:** READY FOR ASSIGNMENT  
**Priority:** HIGH (TS2339 × 25 high-frequency patterns)  
**Timeline:** 2026-04-27+ (pending stakeholder prioritization)  
**Notes:** Phase 36 delivered 73.4% cumulative reduction (462 → 123). Phase 37 targets TS2339 × 25 (high-frequency HTTP boundaries + component props) + remaining TS2322 × 27 (DB schema patterns). Pattern analysis required before execution. M1/M2/M3 carry-forwards pending scope and timeline.
