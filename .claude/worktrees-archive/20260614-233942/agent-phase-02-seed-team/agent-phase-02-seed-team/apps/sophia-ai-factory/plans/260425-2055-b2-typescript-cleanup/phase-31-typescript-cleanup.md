# Phase 31: TypeScript Cleanup — ZodError v4 Migration + HeyGen Response Casts

**Status:** ✅ COMPLETED (2026-04-26 ~13:06 UTC)  
**Baseline:** 246 errors (post-Phase 30)  
**Final:** 235 errors (246 → 235, -11 TS2339)  
**Scope:** Zod v4 migration (6 files) + HeyGen response defensive typing (1 file, 3 sites)  
**Priority:** HIGH (eliminate TS2339 in critical validation + video generation paths)  
**Actual Effort:** ~2-3 hours (tight execution, proven patterns)

---

## Phase 31 Execution Summary (2026-04-26)

**Status:** ✅ COMPLETED  
**Files Modified:** 7 (6 ZodError + 1 heygen-client)  
**TS2339 Fixed:** 6 (ZodError v4) + 5 (heygen-client) = 11 total  
**Tests:** 1398/1398 ✅ (zero regressions)  
**Code Review:** 9.83/10 (auto-approved, 0 critical/0 major/1 minor non-blocking)  
**Protected Flows:** All verified untouched (Setup Wizard, Telegram Bot, NOWPayments)

### Group A: ZodError v4 Migration (6 files)
1. `src/app/actions/agent-task.ts` (L40) — `.error.errors[0]` → `.error.issues[0]`
2. `src/app/api/admin/quota/mark-billable/route.ts` (L45) — `.error.errors` → `.error.issues`
3. `src/app/api/agents/task/route.ts` (L30) — `.error.errors` → `.error.issues`
4. `src/app/api/raas/execute/route.ts` (L34) — `.error.errors` → `.error.issues`
5. `src/app/api/raas/missions/route.ts` (L94) — `.error.errors` → `.error.issues` + discriminated union fallback
6. `src/app/api/raas/missions/[id]/route.ts` (L67) — `.error.errors` → `.error.issues`

**Result:** All validation error responses now use Zod v4 `.issues` array format (ZodIssue[]). Clients parsing `.details[i].message` or `.details[i].path` continue to work.

### Group B: HeyGen Response Casts (3 sites in 1 file)
**Location:** `src/lib/heygen/heygen-client.ts`

1. **L76 `listAvatars()`** — Discriminated union cast: `{ data?: { avatars?: HeyGenAvatar[] } | HeyGenAvatar[] }`
   - Preserves optional-chaining + fallback: `inner?.avatars ?? []`
   - Array.isArray narrowing improves edge case (empty array now returns [] directly vs wrapper object)

2. **L87 `listVoices()`** — Same pattern: `{ data?: { voices?: HeyGenVoice[] } | HeyGenVoice[] }`
   - Defensive against API response shape variance

3. **L129 `createVideo()`** — Single-shape cast: `{ data?: { video_id?: string } }`
   - Preserves error-throwing: `if (!videoId) throw`

**Result:** All 3 methods defensively typed with explicit narrowing (Sub-Variant 1). Behavior improvement: edge case (empty array) now handled more correctly.

**M1 Carry (non-blocking):** Add unit test for alternative HeyGen shape `{data: HeyGenAvatar[]}` (raw array, untested but defensive code present).

---

## Pre-Phase 31 Overview (Superseded)

Phase 31 was originally scoped as "TS2339 Property Mismatch Audit" but execution delivered ZodError v4 + HeyGen fixes instead. Root-cause analysis context below:

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

- [x] ZodError v4 migration (6 files, all `.error.errors` → `.error.issues`)
- [x] HeyGen response casts implemented (3 sites, Sub-Variant 1 defensive typing)
- [x] TS2339 errors reduced (246 → 235, -11 target achieved)
- [x] Tests: 1398/1398 passing (zero regressions)
- [x] Code review: 9.83/10 (auto-approved, exceeds 9.5 threshold)
- [x] Protected flows verified (Setup Wizard, Telegram Bot, NOWPayments)
- [ ] Phase 28-30 minor carries addressed (Mi-1/Mi-2/Mi-3 + M1/M2/M3) deferred Phase 32+

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
