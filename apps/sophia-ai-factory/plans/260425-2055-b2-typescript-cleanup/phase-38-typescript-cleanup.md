# Phase 38: TypeScript Cleanup — TS2339 + TS2322 Remaining Patterns

**Status:** 📋 READY FOR PLANNING (2026-04-26 post-Phase 37)
**Baseline:** 112 errors (post-Phase 37)
**Target:** TS2339 (18 remaining) + TS2322 (20 remaining) + other (74 remaining) cleanup
**Priority:** HIGH (reduced-scope TS2339 patterns + DB schema consolidation)
**Estimated Effort:** 6-8 hours (refined scope post-Phase 37)

---

## Overview

Phase 38 targets remaining 112 errors after Phase 37's mixed batch.

**Error Distribution:**
1. **TS2339** (18 remaining) — Property mismatches (reduced from 25; Phase 37 eliminated 7 high-frequency patterns)
2. **TS2322** (20 remaining) — Type assignment mismatches (reduced from 27; Phase 37 eliminated 7 DB schema patterns)
3. **Other types** (74 remaining) — Distributed categories (TS2345, TS2307, TS2304, etc.)

**Phase 37 Carry-Forwards (Deferred Phase 38):**

| Carry | Category | Scope | Effort | Priority | Status |
|-------|----------|-------|--------|----------|--------|
| C1 | OverageEventRow consolidation | `OverageEventRow` type defined in 2 places (billing-types.ts + supabase/types.ts) — DRY consolidation candidate | 0.5-1h | MEDIUM | Pending execution Phase 38+ |
| C2 | Customer[] envelope verify | Bulk data structure standardization — verify Customer[] response shape consistency | 0.5-1h | MEDIUM | Pending execution Phase 38+ |
| C3 | Remaining TS2339 patterns | HTTP boundaries + component props scope (18 errors, lower frequency than Phase 37 batch) | 2-3h | HIGH | Pending execution Phase 38+ |

---

## TS2339 Candidates (18 errors — Refined Scope)

**Phase 37 Progress:** 25 → 18 (-7 high-frequency patterns eliminated)

**Remaining Patterns (Low-Mid Frequency):**

| Rank | Pattern | Estimated Count | Files | Effort | Approach |
|------|---------|-----------------|-------|--------|----------|
| 1 | HTTP response-body cast (remaining scope) | 4-6 | TBD (scan) | 1-1.5h | Sub-Variant 1-4 batch |
| 2 | Component prop narrowing | 3-4 | TBD (scan) | 0.75-1h | Local interface cast |
| 3 | DB schema mismatch (non-D1) | 2-3 | TBD (scan) | 0.75-1h | Sub-Variant X (DB cast) |
| 4 | Misc singletons | 3-5 | TBD (scatter) | 1-1.5h | Pattern triage required |

**Recommended Phase 38 Approach:**
1. Grep for remaining TS2339 errors (scan post-Phase 37)
2. Categorize by root cause (HTTP boundary, DB schema, component prop)
3. Execute Phase 38 batch targeting TS2339 × 18 (target: 18 → ≤ 5)

---

## TS2322 Candidates (20 errors — Refined Scope)

**Phase 37 Progress:** 27 → 20 (-7 DB schema + object instantiation patterns)

**Remaining DB Schema + Type Assignment Patterns:**
- Scan error locations for common patterns in remaining 20 errors
- Identify if additional sister-file pattern exists (Phase 23/36 sister-pair paradigm)
- Cluster by endpoint type (internal, public, admin)

**Estimated Phase 38 Effort:** 2-3 hours (reduced scope post-Phase 37)

---

## Execution Paths (Phase 38)

### Path A: TS2339 Comprehensive + C1/C2/C3 Carries (Recommended)

1. **Pre-execution analysis (0.5h):**
   - Grep all remaining TS2339 errors (post-Phase 37)
   - Cluster by pattern (HTTP boundary, DB schema, component prop)
   - Rank by frequency + effort

2. **Execute TS2339 batch (3-4h):**
   - HTTP response-body casts (Sub-Variant 1-4) — 1-1.5h
   - Component props (local interface cast) — 0.75-1h
   - DB schema variants (Sub-Variant X) — 0.75-1h
   - Misc singletons (pattern triage) — 1-1.5h

3. **C1/C2/C3 carry-forwards (1-1.5h):**
   - OverageEventRow consolidation: DRY refactor (2 sources → 1 canonical)
   - Customer[] envelope verify: bulk data structure alignment
   - Documentation: consolidation rationale + import updates

**Result Target:** 112 → ~90-100 errors (10-15% Phase 38 reduction, 80-82% cumulative)

### Path B: TS2339 Fast-Track + TS2322 Pilot (Aggressive)

1. Focus TS2339 (18 errors only) — aggressive batching
2. Execute C1/C2/C3 carries
3. If time permits: Identify TS2322 remaining patterns + execute 1-2 representative batches

**Result Target:** 112 → ~80-90 errors (15-20% Phase 38 reduction, 82-84% cumulative)

---

## Success Criteria (Phase 38)

- [ ] TS2339 errors reduced (18 → target ≤ 5)
- [ ] TS2322 remaining candidates identified and scored (20 → target ≤ 10)
- [ ] Root causes documented by error type + pattern
- [ ] Tests: 1398/1398 passing (zero regressions)
- [ ] Code review: >= 9.5/10
- [ ] C1 OverageEventRow consolidation if time permits
- [ ] C2 Customer[] envelope verify if time permits
- [ ] Phase 39 backlog documented (remaining TS2339 + TS2322 + other patterns)

---

## Related Links

- **Phase 37 Completion:** `phase-37-typescript-cleanup.md`
- **Plan Overview:** `plan.md`
- **Tech Debt Tracker:** `plans/reports/TECH_DEBT_TRACKING.md`
- **Phase 37 Tester Report:** `plans/reports/tester-260426-1418-b2-phase37-mixed-batch.md`
- **Phase 37 Review Report:** `plans/reports/code-review-260426-1418-b2-phase37-mixed-batch.md`

---

**Status:** READY FOR ASSIGNMENT
**Priority:** HIGH (TS2339 × 18 refined patterns + C1/C2/C3 consolidation)
**Timeline:** 2026-04-27+ (pending stakeholder prioritization)
**Notes:** Phase 37 delivered 75.8% cumulative reduction (462 → 112). Phase 38 targets TS2339 × 18 (refined HTTP boundaries + component props) + remaining TS2322 × 20 (DB schema patterns) + C1/C2/C3 carries. Pattern analysis ongoing post-Phase 37 execution. Cumulative: 462 → 112 (75.8% completed, 350 remaining).
