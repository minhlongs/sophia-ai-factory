# Phase 14 — `toError()` Slice 2 (next ~30 sites)

**Status:** ✅ COMPLETE (2026-04-20)
**Priority:** P2 (Tech-debt polish — Phase 13 continuation)
**Session:** CLOSED

## Scope

Continuation of Phase 13 `as Error` → `toError()` migration. Next slice of top-concentration files.

### Target Files (34 sites total)

| File | Casts | Context |
|------|-------|---------|
| `src/lib/usage-metering/realtime-tracker.ts` | 7 | circuit breaker + logger.error |
| `src/lib/quota/quota-checker.ts` | 7 | cache + quota logic |
| `src/lib/audit/report-delivery.ts` | 7 | email delivery error paths |
| `src/lib/audit/logger/audit-writer.ts` | 7 | audit write path |
| `src/lib/alerts/realtime-alert-service.ts` | 6 | **latent raw-error sites** (lines 161, 197, 233, 274, 305, 515) |

Last bucket: 6 sites flagged by Phase 13 code reviewer — raw Supabase `error` passed to `logger.error` WITHOUT any cast. Upgrade to `toError()` for consistency + defensive narrowing.

## Approach

### Pattern (unchanged from Phase 13)

```diff
- logger.error('[Scope] Something failed', error as Error)
+ logger.error('[Scope] Something failed', toError(error))
```

For raw-error sites (no cast today):
```diff
- logger.error('[Scope] Query failed', error)
+ logger.error('[Scope] Query failed', toError(error))
```

### Import

Each edited file adds once:
```ts
import { toError } from '@/lib/utils/to-error'
```

## Non-Goals

- Helper changes — already shipped in Phase 13
- New tests for `toError` — already covered (6 cases, 100% coverage)
- Remaining ~160 `as Error` sites — Phase 15+ in further slices of ~30
- `instanceof Error` ternary simplification — separate pattern, Phase 16+

## Files to Edit

- `src/lib/usage-metering/realtime-tracker.ts`
- `src/lib/quota/quota-checker.ts`
- `src/lib/audit/report-delivery.ts`
- `src/lib/audit/logger/audit-writer.ts`
- `src/lib/alerts/realtime-alert-service.ts`

## Success Criteria

- [x] Build: 0 new TS errors
- [x] Tests: 1303/1303 pass (Phase 13 baseline unchanged)
- [x] Lint: 0 new errors on edited files
- [x] 28 `as Error` sites → 0 in the 4 target files
- [x] 6 raw-error sites in realtime-alert-service upgraded to `toError()`
- [x] No behavior regression (logger payload identical for Error instances; strict improvement for non-Error throws)
- [x] Code review score ≥9.5/10 APPROVE ✅ 9.6/10 SHIP
- [x] CI GREEN + Production HTTP 200

## Results (2026-04-20)

| Metric | Value |
|--------|-------|
| Files Edited | 5 |
| `as Error` Casts Fixed | 28 |
| Raw-Error Sites Upgraded | 6 |
| Total Sites Normalized | 34 |
| Tests | 1303/1303 (unchanged) |
| TSC Errors | 0 new |
| Lint Errors | 0 new (pre-existing baseline: 2914) |
| Code Review | 9.6/10 APPROVE, SHIP verdict |
| CI/CD | GREEN |
| Production | HTTP 200 |

### Deferred to Phase 15

- Teach `toError()` to preserve Supabase `PostgrestError` shape (`.code`, `.details`, `.hint`) when input is PostgrestError-like object — per code-reviewer recommendation
- Remaining ~160 `as Error` sites (further slices ~30 sites each)

## Risk Assessment

- **Risk:** VERY LOW — same pattern as Phase 13 (APPROVE 9.7/10).
- **Rollback:** revert-safe.

## Deferred (Phase 15+ backlog)

- Remaining ~160 `as Error` sites (Phase 15, 16, 17 — slices of ~30)
- 244 `instanceof Error` ternary simplifications
- `ClientWithStorage` R2 migration (runtime bug in `report-delivery.ts`)
- ESLint rule to enforce `toError()` (regression guard)
- `raas_licenses` D1-vs-Supabase audit
- Split `lib/usage-metering/types.ts` if still >200L
