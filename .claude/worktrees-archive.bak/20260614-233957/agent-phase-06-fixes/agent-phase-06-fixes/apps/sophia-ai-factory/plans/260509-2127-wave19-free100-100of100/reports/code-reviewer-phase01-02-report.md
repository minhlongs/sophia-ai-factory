# Code Review — Wave 19 Phase 01+02 Batch

**Verdict:** APPROVED ✅ — Score 9.4/10

## Files Reviewed (10)

- `src/seed/config/channels/supported-providers.ts` (NEW, 17 LOC)
- `src/seed/auth/sign-out-button.tsx` (NEW, 44 LOC)
- `src/app/api/v1/integrations/channels/route.ts` (71 LOC)
- `src/app/api/v1/integrations/channels/[provider]/route.ts` (55 LOC)
- `src/app/[locale]/dashboard/layout.tsx` (337 LOC — pre-existing, not bloated by this batch)
- `src/app/[locale]/dashboard/onboarding/page.tsx` (141 LOC)
- `src/app/actions/complete-onboarding-action.ts` (63 LOC)
- `src/forest/quota/video-quota.test.ts` (206 LOC)
- `src/app/actions/__tests__/complete-onboarding-action.test.ts` (NEW, 78 LOC)
- `src/app/api/v1/missions/[id]/stream/route.test.ts` (308 LOC)

## Critical Findings (must-fix before commit)

**None.**

## Medium Findings

1. **layout.tsx 337 LOC > 200 budget** — `dashboard/layout.tsx:1-337` predates this batch but exceeds the file-size guideline. Not introduced here; flag for a follow-up modularization (extract `<DashboardSidebar/>`).
2. **Sign-out fallback URL** — `sign-out-button.tsx:26` posts to `/api/auth/sign-out`. Verified Better Auth catch-all `[...all]` handles this (matches the SDK's own paths). Legacy `/api/auth/logout` exists but is marked DEPRECATED — correct choice. Comment explaining the fallback path would help future maintainers.
3. **Sign-out has no loading/disabled state** — `sign-out-button.tsx` allows multiple rapid clicks during the in-flight signOut promise. Low impact (server is idempotent), but a `useState` guard would be polite. Optional.

## Low Findings

- `complete-onboarding-action.ts:46` — destructure pattern `const { error: updateError }: QueryResult<...>` is clean; the `Record<string, unknown>[]` type-arg is unused at runtime (no `.select()` chained, so `data` is always `null`). Type is correct, just over-specified. Could use `QueryResult<unknown>` for honesty.
- `onboarding/page.tsx:33-51` — `Promise.allSettled` with 4 inline DB calls is acceptable but a tiny named helper (e.g. `countRow(db, sql, ...binds)`) would DRY this. Not blocking.

## Layer Architecture Compliance ✅

- `seed/config/channels/supported-providers.ts` — pure const, seed-appropriate
- `seed/auth/sign-out-button.tsx` — client component using `seed/auth/better-auth-client`. Inversion-free.
- API routes (`app/api/...`) import `seed/auth/better-auth-session` + `forest/middleware/...` — correct (app → forest/seed allowed).
- No `land → forest` or `tree → forest/land` violations.

## Canonical Imports ✅

- `getCurrentUser` / `getCurrentUserFromHeaders` from `@/seed/auth/better-auth-session` ✓
- `createServerClient` (sync) from `@/seed/db/client` ✓
- Zero banned imports (`@/lib/auth`, `@/lib/subscription`, `@/lib/unified-tier-config`, `@/lib/tier-gate`)
- Zero `:any` introduced

## D1 Contract Correctness ✅

- DELETE route uses `db.prepare().bind().run()` — `.run()` THROWS on error, wrapped in try/catch returning 500 ✓
- `complete-onboarding-action` uses Supabase-compat chain `db.from().update().eq()` — returns `{data, error}` thenable per `d1-query-chain.ts:148`. Action correctly destructures `error` and forwards. Verified against `execUpdate` (`d1-query-chain-executors.ts:95-110`): no `.select()` ⇒ returns `{data: null, error: null}` on success. Match.

## Provider Parity ✅

GET array (`route.ts:10`) and DELETE allow-list (`[provider]/route.ts:15`) both spread the same `SUPPORTED_PROVIDERS` const → guaranteed parity. C2 fixed correctly.

## Onboarding C5 ✅

- Split into 4 individual `.first()` calls inside `Promise.allSettled` — correct per plan.
- `step2Done = channelsCnt > 0 || telegramCnt > 0` — telegram-only users now resolved.
- `telegram_paired_chats` uses `paired_by` column (not `user_id`) — Wave 17 P04 historical bug avoided ✓

## Test Quality Assessment

- **Mocks realistic:**
  - `complete-onboarding-action.test.ts` — chain shape mirrors real `D1QueryChain.then` resolution (resolves to `{data, error}`). Avoids the Wave 17 Batch 1 C2 lesson (no fictional `.error` on `.run()`).
  - `video-quota.test.ts` — uses `prepareSpy` returning `bind().all()` (matches `.run()` for DML on raw D1). MASTER row added with both happy path (count=1000 → reserved=true) and saturated path (count=1000 → reserved=false). Tight boundary lock.
  - `stream/route.test.ts:281-308` — cross-user case: `validateMissionApiKey` returns `userA`, `single()` resolves `{data: null}` because real route filters by `.eq('user_id', userId)` (line 148 of route.ts). Asserts `event: error` + `code:not_found`. RED-test will fire if `.eq('user_id', ...)` is removed — exactly the regression lock requested.
- **Assertions tight:** body contains both `event: error` AND `"code":"not_found"` — won't false-positive on unrelated error events.

## Sign-Out C3 ✅

- `authClient.signOut()` invokes Better Auth's session destruction (server-side cookie clear + client cache invalidation).
- Fallback `fetch('/api/auth/sign-out', {credentials: 'include'})` covers SDK-failure edge case.
- `router.replace('/')` + `router.refresh()` — invalidates RSC cache to prevent back-button restore. Verified pattern.

## Metrics

- Type Coverage: 100% — zero `:any`
- New LOC under budget: 17 + 44 + 78 = 139 lines added (3 new files all <80 LOC)
- Test additions: 1 MASTER boundary block (2 cases) + 3 onboarding cases + 1 cross-user case = 6 new test cases

## Unresolved Questions

- Should `dashboard/layout.tsx` be modularized as a follow-up Wave 19 phase? (337 LOC, well above 200-line guideline.) Not blocking this batch.
- `complete-onboarding-action.ts:18` imports `QueryResult` from `@/seed/db/d1-query-types` directly — convention elsewhere is via `@/seed/db/d1-query-builder` barrel. Either path works (barrel re-exports it); minor consistency nit.
