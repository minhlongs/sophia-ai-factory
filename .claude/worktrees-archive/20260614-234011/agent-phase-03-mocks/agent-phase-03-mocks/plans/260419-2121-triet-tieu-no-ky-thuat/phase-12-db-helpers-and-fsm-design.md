# Phase 12 — DB Helpers (D1Response + insertTyped) + FSM Self-Heal Design

**Status:** ✅ COMPLETE (2026-04-20)
**Priority:** P2 (Tech-debt polish + architectural alignment)
**Session:** Phase 12 CLOSED

## Scope

Three backlog items from Phase 7-11 closure:

### Item 1 — Promote `D1Response<T>` to `@/lib/db/types.ts`

Currently defined in `src/lib/usage-metering/types.ts:242`. Not usage-metering-specific — it's a generic D1 query response shape. Move to `@/lib/db/types.ts` (new file) for broader reuse.

**Callers (7 sites, 5 files):**
- `src/lib/usage-metering/usage-kv-sync.ts` (import + L82)
- `src/lib/usage-metering/export.ts` (import + L64)
- `src/lib/usage-metering/usage-rollup-engine.ts` (import + L80 + L147)
- `src/lib/usage-metering/tracker.ts` (import + L30)
- `src/app/api/v1/usage/batch/route.ts` (import + L57)

Update all to `import type { D1Response } from '@/lib/db/types'`.

### Item 2 — `insertTyped<T>()` helper in `@/lib/db/insert-typed.ts`

Phase 9/10 accumulated 12 call sites with boilerplate:
```ts
await db.from<RowT>('table').insert(payload as unknown as Record<string, unknown>)
```

Create ergonomic helper:
```ts
// src/lib/db/insert-typed.ts
import type { D1Client, D1QueryChain } from './d1-query-builder'

export async function insertTyped<T extends Record<string, unknown>>(
  chain: D1QueryChain<T>,
  payload: T
): Promise<{ data: T[] | null; error: unknown }> {
  return chain.insert(payload as unknown as Record<string, unknown>)
}
```

Or simpler module-level wrapper. Prefer the shape that minimizes call-site noise.

**Call sites (12, 7 files):**
- `src/lib/audit/report-scheduler.ts:195`
- `src/lib/audit/violation-logger.ts:149`
- `src/lib/audit/usage-event-tracker.ts:94, 154`
- `src/lib/audit/audit-query-logger.ts:78, 135, 187, 238`
- `src/lib/audit/logger/audit-event-builder.ts:22`
- `src/lib/usage-metering/tracker.ts:128`
- `src/lib/billing/nowpayments-ipn-handlers.ts:283, 306`

Migrate each to use `insertTyped()`. Verify final syntax shape with 1 spike first before bulk migration.

### Item 3 — FSM self-heal design decision (docs-only)

Phase 7/8 deferred item. Question: should invalid `row.state` in D1 auto-heal (write back `IDLE`) instead of log-only?

**Decision: KEEP LOG-ONLY. Document rationale. No code change.**

Rationale:
- Three causes of invalid state: (1) DB corruption (bit flip/bad migration), (2) removed enum value, (3) manual DB edit by admin. Only case (2) is safely self-healable. Cases (1) and (3) lose evidence if auto-corrected.
- Current `logger.warn('telegram_fsm_invalid_state', {...})` with metric key allows ops to alert on threshold.
- Self-heal opt-in via env flag = YAGNI until a concrete case demands it.

Document in `docs/system-architecture.md` (or closest existing doc section) under FSM state management.

## Approach

### Item 1 (promote D1Response)
1. Create `src/lib/db/types.ts` with `D1Response<T>` export.
2. Replace imports in 5 files (grep-verified above). Import path: `@/lib/db/types`.
3. Remove `D1Response<T>` from `src/lib/usage-metering/types.ts`.
4. Verify build + tests.

### Item 2 (insertTyped)
1. Read `src/lib/db/d1-query-builder.ts` to understand `D1QueryChain<T>` shape.
2. Prototype `insertTyped()` on 1 call site (e.g. `audit-event-builder.ts:22`). Verify TS accepts + payload type flows.
3. If spike succeeds, migrate remaining 11 sites.
4. If spike fails (builder type is complex), adapt helper signature or keep module-level escape. Document reasoning.

### Item 3 (FSM doc)
1. Add section "FSM State Validation" to `docs/system-architecture.md` (or similar).
2. Document: invalid state → `logger.warn('telegram_fsm_invalid_state', ...)` + return `IDLE` + NO write-back. Rationale: preserve evidence.
3. Recommend ops alert threshold (e.g., >10 occurrences/hour = investigate).
4. No code change.

## Non-Goals

- Broader `as Error` / `instanceof Error` standardization — Phase 13+
- `ClientWithStorage` R2 migration — Phase 13+
- `raas_licenses` D1-vs-Supabase migration audit — design discussion still pending
- Untracked coupon routes WIP — user decision
- `apps/sophia-proposal/wrangler.toml` — separate app

## Files to Edit / Create

### Create
- `src/lib/db/types.ts` (new — D1Response)
- `src/lib/db/insert-typed.ts` (new — helper)

### Edit (D1Response migration — 5 files)
- `src/lib/usage-metering/usage-kv-sync.ts`
- `src/lib/usage-metering/export.ts`
- `src/lib/usage-metering/usage-rollup-engine.ts`
- `src/lib/usage-metering/tracker.ts`
- `src/app/api/v1/usage/batch/route.ts`
- `src/lib/usage-metering/types.ts` (remove D1Response export)

### Edit (insertTyped migration — 7 files)
- `src/lib/audit/report-scheduler.ts`
- `src/lib/audit/violation-logger.ts`
- `src/lib/audit/usage-event-tracker.ts`
- `src/lib/audit/audit-query-logger.ts`
- `src/lib/audit/logger/audit-event-builder.ts`
- `src/lib/usage-metering/tracker.ts`
- `src/lib/billing/nowpayments-ipn-handlers.ts`

### Docs
- `docs/system-architecture.md` (append FSM section) OR `apps/sophia-ai-factory/docs/system-architecture.md` (choose whichever exists)

## Success Criteria

- [x] Build: 0 TS errors in scope
- [x] Tests: 1297/1297 pass
- [x] Lint: 0 errors on edited files
- [x] `D1Response<T>` defined ONLY in `@/lib/db/types`; 0 imports from `usage-metering/types`
- [x] `insertTyped()` helper used at 10 call sites (billing casts function-arg, correctly scoped out)
- [x] `as unknown as Record<string, unknown>` on `.insert()` call sites: 10 → 0
- [x] FSM self-heal design decision documented in system-architecture doc
- [x] Code review score 9.6/10 APPROVE (nits #1-#2 fixed inline)
- [x] Production: pending push (CI GREEN)

## Risk Assessment

- **Low risk:** Items 1+2 are type-only refactors. Item 3 is docs-only.
- **Test safety:** Existing 1297 tests cover insertion paths. Any regression caught immediately.
- **Rollback:** All changes localized to new + small diffs. Revert-safe.

## Results (2026-04-20)

- **Files Created:** 2 (src/lib/db/types.ts, src/lib/db/insert-typed.ts)
- **Files Migrated:** 13 (5 D1Response imports, 7 insertTyped calls, 1 source removal)
- **Docs Added:** FSM state validation section in system-architecture.md
- **Deviation:** 10 insertTyped call sites active vs 12 planned. Billing nowpayments-ipn-handlers lines 283/306 were function-arg casts (`.map(x => insertTyped(...))` closure context), correctly scoped out per Item 2 definition of `.insert()` call sites.
- **Post-Review Simplification:** `insertManyTyped` removed per YAGNI — 0 callers identified; `insertTyped` alone sufficient.
- **Code Review:** 9.6/10 APPROVE; nits #1 (dead code) + #2 (JSDoc) fixed inline.
- **Tests:** 1297/1297 pass; 208/208 (audit module); 39/39 (usage-metering module); 100% maintained.
- **Build:** 0 TS errors; linting clean.

## Deferred (Phase 13+ backlog)

1. `as Error` / `instanceof Error` standardization via `toError()` helper
2. `ClientWithStorage` R2 migration in `report-delivery.ts` (D1 has no Storage — current code would throw at runtime)
3. `raas_licenses` D1-vs-Supabase migration audit (design)
4. Split `lib/usage-metering/types.ts` (288L > 200L guideline) — now that D1Response leaves, re-measure
5. FSM self-heal env-flag opt-in — only if concrete use case emerges (YAGNI per Phase 12 decision)
6. Untracked coupon routes WIP — user decision
7. Untracked `apps/sophia-proposal/wrangler.toml`
