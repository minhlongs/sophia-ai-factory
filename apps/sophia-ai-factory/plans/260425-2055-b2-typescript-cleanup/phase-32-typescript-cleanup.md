# Phase 32: TypeScript Cleanup — TS2339 Property Mismatch Deep Dive

**Status:** 📋 PLANNING (2026-04-26)  
**Baseline:** 235 errors (post-Phase 31)  
**Target:** Reduce TS2339 property mismatch errors (current: 61 instances, highest remaining)  
**Priority:** HIGH (61 TS2339 > 49 TS2322 > 41 TS2352 by frequency)  
**Estimated Effort:** 4-6 hours (mixed complexity, root-cause analysis required)

---

## Overview

Phase 32 targets the remaining TS2339 "Property X does not exist on type Y" errors following Phase 31's Zod v4 + HeyGen fixes. Root causes typically involve:

1. **DB row shape mismatches** — Cloudflare D1/Supabase query results don't match local interfaces
2. **Schema evolution gaps** — Migration changes not reflected in type interfaces  
3. **Optional field semantics** — Using required fields as optional or vice versa
4. **HTTP response boundaries** — External API responses not matching local interfaces
5. **Cast boundary patterns** — Similar to HTTP boundary anti-corruption (Phase 8-30 patterns)

---

## High-Frequency TS2339 Candidates (Phase 31 Carve-Out)

**Phase 31 eliminated 11 TS2339 errors:**
- 6 ZodError v4 property renames (`.errors` → `.issues`)
- 5 HeyGen response shape properties (Array.isArray narrowing fixes)

**Remaining 61 TS2339 errors — Preliminary Top Targets:**

| Rank | Component | Error Count | Root Cause Hypothesis | Effort |
|------|-----------|-------------|------------------------|--------|
| 1 | `smart-resume-engine` | 6 | Resume generation response shape mismatch | 1.5-2h |
| 2 | `alerts/rules` | 6 | Alert rule schema evolution gap | 1.5-2h |
| 3 | `alerts/preferences` | 6 | User preference field optionality | 1.5-2h |
| 4 | `errors/report` | 5 | Error telemetry shape mismatch | 1-1.5h |
| 5 | `analytics/export` | 4 | Export data structure mismatch | 1-1.5h |
| 6-10 | Other files | 28 | Various (mixed root causes) | 3-4h |

**Action Required:** Run `npx tsc --noEmit 2>&1 | grep "TS2339" | head -30` to identify top targets + root causes.

---

## Phase 31 Inherited Context & Carries

**Phase 31 Discoveries:**
- M1 (Phase 31 review): Add unit test for HeyGen alternative shape `{data: HeyGenAvatar[]}` (defensive code untested)

**Phase 28-30 Review Carries (Still Pending):**
- Mi-1: JSDoc clarification in `is-user-admin.ts` (session-trust asymmetry)
- Mi-2: Unit test assertion refinement in `is-user-admin.test.ts`
- Mi-3: Tier behavior change comment in `usage/export/post-handler.ts`
- M1 (Phase 30): ScrollArea polish if UX needs native scroll enhancement
- M2 (Phase 30): Orphan `LicenseAlertPanel` component — flag for dead-code sweep
- M3 (Phase 30): Duplicate `Env` interfaces in `worker/lib/` — DRY consolidation

**Remain in Phase 32+ Scope (No Action Yet):**
- 61 TS2339 property mismatches (core Phase 32 focus)
- 49 TS2322 type assignment incompatibilities (follow-up phase)
- 41 TS2352 type assertions (double-cast pattern cleanup)
- User.role tightening (Phase 24 doctrine question)
- audit-log-table.tsx >200 LOC modularization
- Structured error responses (P1)
- Subscription race window
- AuditLog camelCase mismatch
- Zod migration admin endpoints
- Polar/Stripe lifecycle (product input)
- 1 unmigrated logger site `violations-get-handler.ts` (Phase 28 carry)

---

## Phase 32 Execution Paths

### Path A: Top-Down Breakdown (Recommended)

1. Run error categorization: `npx tsc --noEmit 2>&1 | grep "TS2339" | awk -F'(' '{print $1}' | sort | uniq -c | sort -rn | head -10`
2. Target top 5-10 highest-frequency files
3. For each file:
   - Analyze error context (component lifecycle, API boundary, DB query)
   - Identify root cause (schema mismatch, optional semantics, cast needed)
   - Apply minimal fix: interface update, optional marker, or type alias
   - Reuse HTTP boundary anti-corruption patterns from Phase 8-30 if applicable
4. Iterate until 61 → X (target ≤ 20 for Phase 33)

**Estimated effort:** 4-5 hours (mix of 1-3 errors per file, varying complexity)

### Path B: Known Candidates First (Fast Track)

1. Fix `smart-resume-engine.ts` (6 errors, resume generation response shape)
   - Analyze response type vs interface
   - Apply HTTP boundary cast pattern if needed
   - **Estimated:** 1.5-2 hours

2. Fix `alerts/rules*.ts` (6 errors, alert rule schema evolution)
   - Audit schema changes vs interface
   - Apply interface update or cast pattern
   - **Estimated:** 1.5-2 hours

3. Fix `alerts/preferences*.ts` (6 errors, user preference optionality)
   - Clarify optional vs required fields
   - Apply interface tightening
   - **Estimated:** 1.5-2 hours

4. Fix remaining candidates (28 errors across alerts/export, errors/report, others)
   - Triage and batch by pattern
   - Apply fixes
   - **Estimated:** 2-3 hours

**Estimated effort:** 4-6 hours (known fast wins + incremental cleanup)

---

## Success Criteria (Phase 32)

- [ ] TS2339 errors categorized and top 10 files identified
- [ ] Smart-resume-engine, alerts/rules, alerts/preferences targeted
- [ ] Root causes documented (schema mismatch vs optional semantics vs cast needed)
- [ ] Property mismatch fixes implemented (61 → X, target ≤ 20 remaining)
- [ ] Tests: 1398/1398 passing (zero regressions)
- [ ] Code review: >= 9.5/10
- [ ] Phase 28-31 minor carries addressed (M1-M3 + Mi-1-Mi-3) if time permits

---

## Related Links

- **Phase 31 Completion:** `phase-31-typescript-cleanup.md`
- **Phase 30 Completion:** `phase-30-typescript-cleanup.md`
- **Tech Debt Tracker:** `plans/reports/TECH_DEBT_TRACKING.md`
- **Code Standards:** `docs/code-standards.md`
- **Development Rules:** `.claude/rules/development-rules.md`

---

**Status:** READY FOR ASSIGNMENT  
**Priority:** HIGH (61 TS2339 errors, highest remaining after Phase 31)  
**Timeline:** 2026-04-27+ (pending stakeholder prioritization)  
**Notes:** Phase 31 eliminated 11 TS2339 errors (ZodError v4 + HeyGen shapes). Phase 32 targets remaining 61 property mismatches. Paths A (breakdown) and B (known-candidates) available. Top candidates: smart-resume-engine (6), alerts/rules (6), alerts/preferences (6), others TBD via automated categorization.
