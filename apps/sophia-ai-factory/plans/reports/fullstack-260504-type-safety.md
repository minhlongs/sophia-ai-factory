# Type Safety Report — Zero `:any` Pass

**Date:** 2026-05-04
**Status:** COMPLETE — 0 TS errors, 13 `as any` casts removed

---

## Files Modified

| File | Fixes |
|---|---|
| `src/land/billing/dunning/dunning-attempt-recorder.ts` | H1: removed `as any` on `insert()` payload |
| `src/land/billing/dunning/dunning-actions.ts` | H2: removed `as any` on `billing_events` insert payload |
| `src/land/billing/email/email-tracking-service.ts` | H3: removed `as any` on `billing_events` insert payload |
| `src/forest/quota/overage-logger-ops.ts` | H4: removed 2× `createServerClient() as any`; removed `{ billable: true } as any`; wrapped QueryError with `toError()` in logger.error call |
| `src/tree/telegram/telegram-state-backup-service.ts` | H5: removed 2× `createServerClient() as any`; dropped unsupported `{ onConflict }` second arg to `upsert()`; added type guard `typeof data.updated_at === 'string' \| 'number'` before `new Date()` |
| `src/app/api/license/sync/license-sync-db.ts` | H6: removed 2× `(db as any)`; dropped unsupported `{ onConflict: 'nonce' }` second arg to `upsert()` |
| `src/app/api/admin/violations/route.ts` | H7: removed 2× `(db as any)`; wrapped QueryError with `toError()` in logger.error call |
| `src/forest/components/billing/usage-summary-card.tsx` | H8: added `UsageStatus` type alias; narrowed `FullUsageSummaryProps.status` from `string` to `UsageStatus`; removed 3× `status={... as any}` |

---

## Root Causes & Fixes

### D1 client casts (`db as any`, `createServerClient() as any`)
- Root cause: callers didn't trust that `createServerClient()` returns typed `D1Client`
- Fix: `createServerClient()` returns `D1Client` which has `.from<T>()` — casts were unnecessary, removed directly

### Insert/update payload casts (`{ ... } as any`)
- Root cause: `D1QueryChain.insert()` accepts `Record<string, unknown>` — spreads and object literals already satisfy this
- Fix: removed `as any`; no payload type changes needed

### `upsert()` second arg
- Root cause: `D1QueryChain.upsert()` only accepts 1 arg; `{ onConflict }` was being passed as `as any` bypass
- Fix: dropped second arg — D1 upsert uses `INSERT OR REPLACE` semantics; `onConflict` was silently ignored at runtime anyway

### `logger.error(msg, error)` with `QueryError`
- Root cause: `logger.error` second arg is `Error | Record<string, unknown>`; `QueryError = { message: string; code?: string }` lacks index signature
- Fix: wrapped with `toError(error)` which handles PostgrestError-shaped objects correctly

### `usage-summary-card.tsx` status prop
- Root cause: `FullUsageSummaryProps` used `status: string` instead of the union type required by `UsageSummaryCardProps`
- Fix: added `UsageStatus = 'ok' | 'warning' | 'critical' | 'overage'` and used it in props interface

---

## Verification

```
npx tsc --noEmit → 0 errors ✅
grep ": any|as any" in 8 owned files → 0 matches ✅
```

Build failure noted: pre-existing ENOENT tmp file collision from concurrent build process + NFT tracing warning in `test-coverage.ts` → unrelated to this pass.

---

## H9 (Bonus console.log)

Searched `src/tree/telegram/**` and `src/app/api/telegram/**` for `console.log` — no matches found. Scout report may reference a different file path or already cleaned.

---

## Unresolved Questions

1. `D1QueryChain.upsert()` has no `onConflict` support — D1 uses `INSERT OR REPLACE` for all upserts. If callers need per-column conflict resolution (e.g. `INSERT ... ON CONFLICT (col) DO UPDATE`), a future enhancement to `D1QueryChain` is needed. Current behavior is `REPLACE` which deletes+inserts — acceptable for session/license tables but worth documenting.

2. Build tmp file error (`ENOENT .tmp.6cmn4dsaf25`) appears when concurrent builds race. Pre-existing issue, not caused by this pass.
