# Phase 3A Report — Admin API `:any` Elimination

**Date:** 2026-04-19
**Status:** COMPLETE

## Files Modified

| File | `:any` Removed |
|------|---------------|
| `api/admin/dunning/[licenseNonce]/route.ts` | 2 |
| `api/admin/dunning/[licenseNonce]/restore/route.ts` | 3 |
| `api/admin/dunning/[licenseNonce]/suspend/route.ts` | 3 |
| `api/admin/quota/mark-billable/route.ts` | 1 |
| `api/admin/licenses/[id]/reactivate/route.ts` | 1 |
| `api/admin/audit/reports/download/[id]/route.ts` | 1 |
| `api/admin/usage/customer-linkage/route.ts` | 3 |
| `api/admin/usage/reconciliation/route.ts` | 0 (already clean) |

**Total removed: 14**

## Fix Patterns Applied

- `.single() as any` → typed as `{ data: RowType | null; error: Error | null }`
- `(user as any).user_metadata?.role` → `(user as { user_metadata?: { role?: string } }).user_metadata?.role`
- `(db.from('table') as any).update(...)` → `(db.from('table') as ReturnType<typeof db.from>).update(...)`
- `.update({ ... } as any)` → removed cast, plain object literal
- `(db as any).from(...)` → `(db.from(...) as ReturnType<typeof db.from>)`
- `Record<string, any>` → `Record<string, unknown>`
- Bonus: fixed pre-existing `prefer-const` error in `reconciliation/route.ts` (line 379)

## ESLint Result

0 errors, 4 pre-existing warnings (unused imports: `DunningStateResult`, `RaasLicenseUpdate`, `_`, `licenseInfo`).

## Edge Cases

- `reconciliation/route.ts` had 0 `:any` in owned code — already used proper interfaces (`SupabaseUsageEvent`, `LicenseInfo`). Bonus fix: `let query` → `const query`.
- `mark-billable/route.ts`: `.update({ billable: true, ... } as any)` — the cast was bypassing D1 table type mismatch. Replaced with `ReturnType<typeof db.from>` cast on the table ref instead, keeping the object literal clean.
