# Phase 16 — `toError()` Slice 3 (next 29 sites)

**Status:** ✅ COMPLETE (2026-04-20)
**Priority:** P2 (Tech-debt polish — Phase 13/14 continuation)
**Session:** CLOSED

## Scope

Third slice of the `as Error` → `toError()` migration. 29 sites across 5 top-concentration files.

### Target Files (29 sites)

| File | Casts | Notes |
|------|-------|-------|
| `src/lib/audit/audit-query-logger.ts` | 7 | catch + insertError chain |
| `src/worker/lib/realtime-alert-dispatcher.ts` | 6 | Cloudflare Worker scope |
| `src/lib/auth/enriched-jwt.ts` | 6 | JWT enrich (Polar / license / dunning) |
| `src/worker/lib/r2-report-storage.ts` | 5 | R2 bucket ops in Worker scope |
| `src/lib/usage-metering/kv-metering-log-sync.ts` | 5 | includes 2 `const err = error as Error` idiom sites |

Remaining after Phase 16: ~131 `as Error` sites.

## Approach

### Pattern A — direct logger argument (24 sites)

```diff
- logger.error('[Scope] Something failed', error as Error)
+ logger.error('[Scope] Something failed', toError(error))
```

### Pattern B — locally aliased (5 sites in kv-metering-log-sync)

Two sites on lines 241 + 263:
```diff
- const err = error as Error;
+ const err = toError(error);
```

### Import — add once per file

```ts
import { toError } from '@/lib/utils/to-error'
```

`@/lib/*` alias resolves in `src/worker/` too (already used for `logger-utility`).

## Non-Goals

- Helper changes — Phase 13 helper + Phase 15 PostgrestError preservation already in place.
- New tests for `toError` — 9 cases in place.
- Remaining ~131 `as Error` sites — Phase 17+ in further ~30-site slices.
- `instanceof Error` ternary simplifications — separate pattern.
- ESLint rule to enforce `toError()` — deferred.

## Files to Edit

- `src/lib/audit/audit-query-logger.ts`
- `src/worker/lib/realtime-alert-dispatcher.ts`
- `src/lib/auth/enriched-jwt.ts`
- `src/worker/lib/r2-report-storage.ts`
- `src/lib/usage-metering/kv-metering-log-sync.ts`

## Success Criteria

- [x] Build: 0 new TS errors on the 5 edited files
- [x] Tests: 1306/1306 pass (baseline unchanged)
- [x] Lint: 0 new errors on the 5 edited files
- [x] 29 `as Error` sites → 0 across the 5 files
- [x] No behavior regression (logger payload identical for Error instances; strict improvement for non-Error throws incl. Supabase PostgrestError)
- [x] Code review score ≥9.5/10 APPROVE → auto-ship ✅ 9.8/10 SHIP
- [x] CI GREEN + Production HTTP 200

## Results (2026-04-20)

| Metric | Value |
|--------|-------|
| Files Edited | 5 |
| `as Error` Sites Migrated | 29 (24 direct + 5 aliased/incl. 2 `const err=...`) |
| Tests | 1306/1306 (baseline unchanged — pure migration, no new tests) |
| TSC Errors | 0 new on 5 files (project baseline 621 → 621, zero delta) |
| Lint Errors | 0 new on 5 files |
| Code Review | 9.8/10 APPROVE SHIP (0 blockers / high / medium) |
| Observation | Pre-existing logger-signature tech debt at `enriched-jwt.ts:220/294/399` — flagged for future phase |

## Risk Assessment

- **Risk:** VERY LOW — pattern identical to Phase 13/14 (which shipped 9.6–9.7).
- **Rollback:** revert-safe.

## Deferred (Phase 17+ backlog)

- Remaining ~131 `as Error` sites (Phase 17, 18, 19 — slices of ~30)
- 244 `instanceof Error` ternary simplifications
- `ClientWithStorage` → R2 migration (runtime bug in `report-delivery.ts`)
- ESLint rule to enforce `toError()`
- Teach `logger-utility.ts` to serialize `code/details/hint` when present on Error (pairs with Phase 15 helper)
- `raas_licenses` D1-vs-Supabase audit
- Split `lib/usage-metering/types.ts` if still >200L
