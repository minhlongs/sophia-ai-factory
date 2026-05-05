# TS Errors Fix — 2026-05-03

## Summary
- Initial errors: 12 | Final: 0
- Tests: 2611 passed (before and after)
- TypeScript: `doctor` confirms 0 errors

## Per-File Fixes

### `src/app/api/welcome/validate/[token]/__tests__/route.test.ts` (1 error)
- **Error:** `{ $context: Promise<...> }` not assignable to `Auth<BetterAuthOptions>` via direct cast
- **Fix:** Changed `as ReturnType<typeof getAuth>` → `as unknown as ReturnType<typeof getAuth>` (non-overlapping mock shape requires double cast)

### `src/land/billing/__tests__/nowpayments-ipn-dispatch.test.ts` (5 errors)
- **Error:** `sku.id: string` not assignable to `OneTimeSkuId = 'STARTER_BUNDLE'`; TypeScript widens object literal `id: 'STARTER_BUNDLE'` to `string`
- **Fix:** Added `import type { OneTimeSku }` from `@/seed/types`; typed all 5 `sku` variables as `const sku: OneTimeSku = { ... }` (cases 9, 10, 14, 15, 16)

### `src/land/billing/email/__tests__/send-bundle-generating-email.test.ts` (2 errors)
- **Error:** `{ from: Mock }` doesn't overlap with `D1Client` — direct cast fails
- **Fix:** Changed both `makeDb(...) as ReturnType<typeof createServerClient>` → `as unknown as ReturnType<typeof createServerClient>`

### `src/land/orders/__tests__/pending-order-repo.test.ts` (1 error)
- **Error:** `PendingOrder` has no index signature; can't cast directly to `Record<string, unknown>`
- **Fix:** Changed `(r as Record<string, unknown>)` → `(r as unknown as Record<string, unknown>)`

### `src/lib/fulfillment/__tests__/complete-video-from-webhook.test.ts` (3 errors)
- **Error:** `{ from: Mock }` doesn't overlap with `D1Client` — same pattern as billing email tests
- **Fix:** Changed 3 occurrences of `makeDb(...) as ReturnType<typeof createServerClient>` → `as unknown as ReturnType<typeof createServerClient>`

## Production Issues Flagged
None — all errors were test-side type drift (mock shapes vs actual types).

## One-liner
12 TS errors in 5 test files — all mock-type drift; fixed with `as unknown as` double-cast or explicit `OneTimeSku` type annotation.
