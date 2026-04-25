# Phase 01 — Fix TypeScript Errors + Failing Tests

## Context Links
- Research: `plans/reports/researcher-error-analysis-20260425.md`
- Parent plan: [plan.md](./plan.md)
- Project rules: `.claude/rules/development-rules.md` (zero `:any` policy)

## Overview
- **Priority:** P0 (BLOCKS CI/CD)
- **Status:** Pending
- **Wave:** 1 (parallel-safe)
- **Effort:** ~4h
- **Owner:** bugfix-agent

Fix 4 failing tests and 5 TypeScript errors to unblock CI/CD. Independent of all other phases.

## Key Insights
- Pagination tests expect string `'1'` but route returns number `1` — type mismatch in serialization or test expectation
- `preRegisterNonce` returns `true` on KV error — wrong fail-open behavior; must fail-closed (`return false`)
- TS errors cluster around `unknown` types from JSON parses + missing properties on `RaasUsageMetrics` → fix at type definition site, not callsites

## Requirements

### Functional
- All 4 failing tests pass without weakening assertions
- All 5 TS errors resolved without `as any` / `@ts-ignore`
- `npm run build` exits 0
- `npm test` exits 0

### Non-Functional
- No regression in unrelated tests
- Maintain `RaasUsageMetrics` type completeness (extend if missing fields)
- Fix at root: prefer fixing schema/type vs casting at callsite

## Related Code Files

### Modify
- `src/app/api/violations/route.ts` — pagination response shape (numbers vs strings)
- `src/app/api/violations/route.test.ts` — align test expectations if route is correct
- `src/lib/auth/jwt-nonce-tracker.ts` — `preRegisterNonce` fail-closed on KV error
- `src/lib/auth/jwt-nonce-tracker.test.ts` — verify failure scenario covered
- `src/app/[locale]/(admin)/admin/analytics/usage/page.tsx` — `errorData` typing
- `src/app/[locale]/(admin)/admin/users/admin-users-client.tsx` — `data` typing (define `AdminUserResponse` interface)
- `src/app/[locale]/dashboard/analytics/components/usage-analytics-view.tsx` — extend `RaasUsageMetrics` props
- `src/app/[locale]/dashboard/analytics/page.tsx` — `Campaign[]` type assertion (define generic-safe parser)
- `src/app/[locale]/dashboard/billing/page.tsx` — guard `usageData` undefined
- `src/lib/analytics/types.ts` — extend `RaasUsageMetrics` with missing fields (root-cause fix)

### Create
- `src/types/admin-user-response.ts` — typed admin users API response (if not already in `types/`)

### Delete
- None

## Implementation Steps

1. **Run baseline:** `npm run build && npm test` — capture exact errors with line numbers.
2. **Fix `jwt-nonce-tracker.ts`:**
   - In `preRegisterNonce`, change KV error catch from `return true` → `return false` (fail-closed; safer security default).
   - Verify test `should return false when KV throws` passes.
3. **Fix `violations/route.ts` pagination:**
   - Decide source of truth: either route returns `{ page: '1' }` (string) OR test expects `{ page: 1 }` (number).
   - Recommend: route returns numbers (cleaner JSON contract); update test expectations.
   - Update both files; ensure type alignment in any pagination interface.
4. **Fix `usage/page.tsx` errorData typing:**
   - Replace `errorData: unknown` with `errorData: { error?: string; message?: string }` interface.
   - Add type guard before accessing `.message`.
5. **Fix `admin-users-client.tsx` data typing:**
   - Create `AdminUserResponse` interface in `src/types/admin-user-response.ts`.
   - Type fetch response: `const data = await res.json() as AdminUserResponse`.
6. **Fix `usage-analytics-view.tsx` missing props:**
   - Read `RaasUsageMetrics` definition in `src/lib/analytics/types.ts`.
   - Add missing fields (likely: `totalRequests`, `errorRate`, `breakdown` etc.) at type def.
   - Avoid casting at component; fix at source.
7. **Fix `dashboard/analytics/page.tsx` Campaign[] assertion:**
   - Replace `as Campaign[]` with parsed/validated array using existing Campaign Zod schema if available.
   - If no Zod schema, create minimal type guard `isCampaignArray(x): x is Campaign[]`.
8. **Fix `billing/page.tsx` undefined usageData:**
   - Add null check: `if (!usageData) return <Skeleton />` OR provide default `usageData ?? defaultUsage`.
9. **Verify:** `npm run build` (0 errors) → `npm test` (all pass).
10. **Commit:** `fix(analytics): resolve TS errors and failing tests blocking CI`

## Todo List
- [ ] Run baseline build + test, capture errors
- [ ] Fix `preRegisterNonce` fail-closed behavior
- [ ] Align violations pagination types (route vs test)
- [ ] Type `errorData` in admin/analytics/usage page
- [ ] Type `data` in admin/users/admin-users-client
- [ ] Extend `RaasUsageMetrics` with missing fields
- [ ] Replace Campaign[] cast with type-safe parsing
- [ ] Guard `usageData` undefined in billing page
- [ ] Final `npm run build` exit 0
- [ ] Final `npm test` 100% pass
- [ ] Commit + push

## Success Criteria
- `npm run build` → 0 TS errors
- `npm test` → 0 failing tests
- No `:any`, no `@ts-ignore`, no weakened test assertions
- CI/CD GitHub Actions green on push

## Risk Assessment
- **R1:** `RaasUsageMetrics` extension breaks other consumers → mitigate by grep all usages first; add optional fields where safe.
- **R2:** Changing `preRegisterNonce` to fail-closed could lock out users on transient KV blip → acceptable; document in code comment.
- **R3:** Pagination type change breaks frontend consumers → grep `pagination.page` usages; align frontend if needed.

## Security Considerations
- `preRegisterNonce` fail-closed = SAFER (prevents replay attack window during KV outage).
- No new auth surface added.

## File Ownership (NO OVERLAP with phases 02-05)
Phase 01 owns:
- `src/app/api/violations/route.ts` + `.test.ts`
- `src/lib/auth/jwt-nonce-tracker.ts` + `.test.ts`
- `src/app/[locale]/(admin)/admin/analytics/usage/page.tsx`
- `src/app/[locale]/(admin)/admin/users/admin-users-client.tsx`
- `src/app/[locale]/dashboard/analytics/components/usage-analytics-view.tsx`
- `src/app/[locale]/dashboard/analytics/page.tsx` ⚠️ shared with Phase 05 (Phase 05 runs AFTER)
- `src/app/[locale]/dashboard/billing/page.tsx`
- `src/lib/analytics/types.ts` (extend only — additive changes)
- `src/types/admin-user-response.ts` (new)

## Next Steps
Once green, signal Wave 2 phases (04 + 05) to start. Wave 1 phases 02 + 03 run in parallel with this phase.
