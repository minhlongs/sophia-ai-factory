# Phase 17 — `toError()` Slice 4 (next 31 sites)

**Status:** ✅ COMPLETE (2026-04-20)
**Priority:** P2 (Tech-debt polish — Phase 13/14/15/16 continuation)
**Session:** CLOSED

## Scope

Fourth slice of the `as Error` → `toError()` migration. 31 sites across 7 top-concentration files.

### Target Files (31 sites)

| File | Casts | Notes |
|------|-------|-------|
| `src/lib/security/api-key-validator.ts` | 5 | incl. 1 inline `(error as Error).message` in template string |
| `src/lib/audit/logger/audit-writer-extended.ts` | 5 | catch + insertError chain |
| `src/app/api/debug/db-schema/route.ts` | 5 | 5× `(e as Error).message` inline (debug endpoint) |
| `src/lib/audit/usage-event-tracker.ts` | 4 | includes `result.error as Error` D1 response branch |
| `src/lib/audit/right-to-erasure.ts` | 4 | **4× `as unknown as Error` double-cast** — GDPR erasure path |
| `src/lib/audit/cron-report-runner.ts` | 4 | incl. 1 inline `(error as Error).message` member assignment |
| `src/lib/alerts/quota/alert-delivery-service.ts` | 4 | email + sms + webhook + umbrella catch |

Remaining after Phase 17: ~100 `as Error` sites.

## Approach

### Pattern A — direct logger argument (22 sites)

```diff
- logger.error('[Scope] Something failed', error as Error)
+ logger.error('[Scope] Something failed', toError(error))
```

### Pattern B — `as unknown as Error` double-cast (4 sites in right-to-erasure.ts)

```diff
- logger.error('Failed to fetch', fetchError as unknown as Error, {...})
+ logger.error('Failed to fetch', toError(fetchError), {...})
```

### Pattern C — inline `.message` expression (5 sites across 3 files)

```diff
- { error: (e as Error).message }
+ { error: toError(e).message }
```

### Import — add once per file

```ts
import { toError } from '@/lib/utils/to-error'
```

## Non-Goals

- Helper changes — locked in Phase 13+15.
- Remaining ~100 `as Error` sites — Phase 18+ in further ~30-site slices.
- `instanceof Error` ternary simplifications — separate pattern.
- ESLint rule to enforce `toError()` — deferred.
- Rewriting `db-schema/route.ts` debug handler beyond the 5 casts.

## Files to Edit

- `src/lib/security/api-key-validator.ts`
- `src/lib/audit/logger/audit-writer-extended.ts`
- `src/app/api/debug/db-schema/route.ts`
- `src/lib/audit/usage-event-tracker.ts`
- `src/lib/audit/right-to-erasure.ts`
- `src/lib/audit/cron-report-runner.ts`
- `src/lib/alerts/quota/alert-delivery-service.ts`

## Success Criteria

- [x] Build: 0 new TS errors on 7 edited files
- [x] Tests: 1306/1306 pass (baseline unchanged)
- [x] Lint: 0 new errors on 7 edited files
- [x] 31 `as Error` sites → 0 across 7 files (incl. 4 `as unknown as Error` + 5 inline `.message`)
- [x] No behavior regression
- [x] Code review ≥9.5/10 APPROVE → auto-ship ✅ 9.8/10 SHIP
- [x] CI GREEN + Production HTTP 200

## Results (2026-04-20)

| Metric | Value |
|--------|-------|
| Files Edited | 7 |
| `as Error` Sites Migrated | 31 (22 direct + 4 `as unknown as Error` + 5 inline `.message`) |
| Tests | 1306/1306 (baseline unchanged — pure migration) |
| TSC Errors | 0 new on 7 files |
| Lint Errors | 0 new on 7 files |
| Code Review | 9.8/10 APPROVE SHIP (0 blockers / nits / unresolved) |
| Diff Shape | +38 / -31 = 1:1 replacement + 7 import additions |
| New Sub-Patterns Handled | `as unknown as Error` (GDPR path) + inline `(e as Error).message` (debug/member assign) |

## Risk Assessment

- **Risk:** VERY LOW — same pattern + `as unknown as Error` is strictly more conservative than what `toError()` enforces.
- **Rollback:** revert-safe.

## Deferred (Phase 18+ backlog)

- Remaining ~100 `as Error` sites (slices ~30 each)
- 244 `instanceof Error` ternary simplifications
- `ClientWithStorage` → R2 migration
- ESLint rule to enforce `toError()`
- Logger-utility structured metadata pickup (`code/details/hint` on Error)
- enriched-jwt.ts logger-signature tech debt (lines 220/294/399 flagged by Phase 16 reviewer)
- `raas_licenses` D1-vs-Supabase audit
- Split `lib/usage-metering/types.ts`
