# Phase 1: Auth Consolidation

## Overview
- Priority: P0
- Status: Complete
- Group: 1 (parallel with Phase 5)
- Effort: 4h (completed)

Delete deprecated auth modules. Single source: `better-auth-session.ts` for getCurrentUser(), `db/get-user-tier.ts` for getUserTier().

## Files to Delete
- `src/lib/auth.ts` — Supabase wrapper, 8 files import it
- `src/lib/db/auth-verify.ts` — deprecated JWT shim, 0 direct imports remain
- `src/lib/subscription.ts` — Supabase-based getUserTier, 2 files import it
- `src/lib/clients/supabase-client.ts` — orphaned, 0 imports

## Files to Update (10 files)

### Analytics routes (import getCurrentUser from @/lib/auth → @/lib/better-auth-session)
1. `src/app/api/analytics/roi/route.ts`
2. `src/app/api/analytics/licenses/route.ts`
3. `src/app/api/analytics/usage/route.ts`
4. `src/app/api/analytics/export/route.ts`
5. `src/app/api/analytics/revenue/route.ts`

### Violation routes
6. `src/app/api/violations/route.ts`
7. `src/app/api/violations/route.test.ts`

### GraphQL
8. `src/lib/analytics/graphql-resolvers.ts`

### Subscription imports → db/get-user-tier
9. `src/app/api/admin/usage/reconciliation/route.ts` — getUserTier from subscription → db/get-user-tier
10. `src/lib/middleware/subscription-gate-middleware.ts` — getUserTier from subscription → db/get-user-tier

## Implementation Steps

1. For each of the 8 files importing `@/lib/auth`:
   - Read file, find what's imported (getCurrentUser, getCurrentTier, hasMinimumTier)
   - Replace with equivalent from `@/lib/better-auth-session` or `@/lib/db/get-user-tier`
   - Note: old getCurrentUser(supabase) takes Supabase client arg, new getCurrentUser() takes no args
   - If file uses `getCurrentTier(user)` — inline the logic or import from get-user-tier

2. For 2 files importing `@/lib/subscription`:
   - Replace `getUserTier` import with `@/lib/db/get-user-tier`

3. Delete the 4 deprecated files

4. Run `npm run build` + `npm test` — must pass

## Success Criteria
- [x] 0 imports from `@/lib/auth` (non-better-auth)
- [x] 0 imports from `@/lib/subscription`
- [x] 0 imports from `@/lib/db/auth-verify`
- [x] 0 imports from `@/lib/clients/`
- [x] Build passes
- [x] Tests pass

## Risk Assessment
- Analytics routes may use Supabase client for DB queries too (Phase 2 scope). Only fix auth imports here, leave DB client for Phase 2.
- `graphql-resolvers.ts` may have complex auth integration — read carefully.
