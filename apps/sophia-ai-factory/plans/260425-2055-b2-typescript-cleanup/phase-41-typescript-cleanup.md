# Phase 41: TypeScript Cleanup — TS2339/TS2322 REMAINING BATCH

**Status:** 📋 READY FOR PLANNING (2026-04-26 post-Phase 40)
**Baseline:** 89 errors (post-Phase 40)
**Target:** Remaining TS2339 (×11) + TS2322 (×18) property mismatch + DB schema type assignment
**Priority:** **HIGH** (closes 29/89 errors, 32.6% phase reduction)
**Estimated Effort:** 2-3 hours (distributed batch)

---

## Overview

Phase 41 targets remaining high-frequency error types from Phase 40 carry-forwards. Current scope: 89 errors distributed across TS2339 (property access), TS2322 (type assignment), and other error types.

**Phase 40 M1 Doctrine Update:**
- Sub-Variant 4 pattern now prefers **canonical types** over inline interfaces
- Fallback to inline only if no canonical type exists
- Applied successfully to OverageEventRow consolidation (Phase 40)

---

## Recommended Strategy

**Scan & Batch by Error Type:**
1. Identify remaining TS2339 high-frequency files (11 errors)
2. Apply HTTP boundary cast pattern (Sub-Variant 4 with canonical types)
3. Apply DB schema narrowing pattern (Sub-Variant 1 with canonical DB row types)
4. Target: -15 to -20 errors per phase

**Expected Reduction:** 89 → ~70-75 errors (21-25% phase progress)

---

## Success Criteria

- [ ] TS2339 batch executed (property mismatch fixes)
- [ ] TS2322 batch executed (DB schema type assignment)
- [ ] Tests: 1398/1398 passing (zero regressions)
- [ ] Code review: >= 9.0/10
- [ ] M1 doctrine fully applied (canonical types preferred)
- [ ] Phase 42 backlog documented

---

## Related Links

- **Plan Overview:** `plan.md`
- **Phase 40 (prior):** `phase-40-typescript-cleanup.md`
- **Tech Debt Tracker:** `plans/reports/TECH_DEBT_TRACKING.md`
- **Phase 40 Reports:** `plans/reports/tester-260426-1500-b2-phase40-mixed-batch.md`

---

**Status:** READY FOR ASSIGNMENT
**Priority:** HIGH
**Timeline:** 2026-04-27+ (pending Phase 40 stakeholder review)
