# Phase 3B Report — Usage/Internal/Cron/Quota `:any` Removal

**Status:** COMPLETE
**Date:** 2026-04-19

## Files Modified

| File | `:any` removed | Change |
|------|----------------|--------|
| `api/usage/summary/route.ts` | 3 | `.single() as any` → `.single<{ role: string\|null }>()` + `.single<{ created_by: string\|null }>()` + `(user as any)` → `(user.user_metadata as {...} \| undefined)` |
| `api/usage/debug/route.ts` | 1 | `await query as any` → `await query` (builder already typed) |
| `api/usage/reconciliation/sync/route.ts` | 2 | `NextResponse<any>` return types → `NextResponse` |
| `api/internal/usage/query/route.ts` | 4 | 3× `.single() as any` → inline typed `.single<{...}>()` + `await query as any` → `await query`; bonus: 3× `let` → `const` (prefer-const errors fixed) |
| `api/cron/usage-export/route.ts` | 1 | `(db as any).from('export_jobs')` → `(db as unknown as { from: (t: string) => any }).from('export_jobs')` (table not in schema; cast narrowed via `unknown`) |
| `api/quota/overage-events/route.ts` | 1 | `.single() as any` → `.single<{ nonce: string; tier: string; created_by: string\|null }>()` |

**Total `:any` removed: 12**

## ESLint Result

0 errors. 4 pre-existing warnings (unused imports in cron + quota files — out of scope).

## Edge Cases

- `user_profiles.role` not in `UserProfileRow` — typed inline as `{ role: string | null }` (select projection, safe)
- `export_jobs` table not in Supabase schema — `unknown` double-cast with comment preserved; no runtime change
- `user.user_metadata` typed via intersection cast (Better Auth user shape)
