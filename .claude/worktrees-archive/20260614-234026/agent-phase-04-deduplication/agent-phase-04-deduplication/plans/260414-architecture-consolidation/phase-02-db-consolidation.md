# Phase 2: Database Client Consolidation

## Overview
- Priority: P0
- Status: Complete
- Group: 2 (sequential, after Group 1)
- Effort: 16h (completed)

Migrate 119 files from Supabase client → D1 client. Delete deprecated Supabase modules.

## Files to Delete
- `src/lib/supabase/client.ts` — browser client (5 imports)
- `src/lib/supabase/admin.ts` — admin client (77 imports)
- `src/lib/supabase/server.ts` — server client (37 imports)
- Keep: `src/lib/supabase/types.ts` — generated types (referenced for TS types only)

## Scope: 119 files to migrate

### Pattern A: `createClient()` from supabase/server (37 files)
Replace with `createServerClient()` from `@/lib/db/client`.
Query patterns are compatible (both use `.from().select().eq()` builder).

### Pattern B: `createAdminClient()` from supabase/admin (77 files)
Replace with `getD1Client()` or `createServerClient()` from `@/lib/db/client`.
Admin client was used for server-side elevated queries — D1 has no RLS, so createServerClient works.

### Pattern C: Supabase browser client (5 files)
These client components call Supabase directly. Replace with:
- Fetch from API routes (server-side D1)
- Or use `authClient` from better-auth for auth-related calls

### Exception: OAuth callbacks (keep Supabase)
- `src/lib/tiktok/tiktok-oauth-client.ts` — needs Supabase for OAuth token storage
- `src/lib/youtube/youtube-oauth-client.ts` — same
- `src/app/api/auth/tiktok/callback/route.ts`
- `src/app/api/auth/youtube/callback/route.ts`
These 4 files keep Supabase imports (OAuth token table is in Supabase Postgres).

## Implementation Steps

1. Create a helper script or grep to find all Supabase imports
2. For each file, replace import + client creation:
   ```ts
   // Before
   import { createAdminClient } from '@/lib/supabase/admin';
   const supabase = createAdminClient();
   const { data } = await supabase.from('table').select('*');
   
   // After
   import { createServerClient } from '@/lib/db/client';
   const db = createServerClient();
   const { data } = await db.from('table').select('*');
   ```
3. Handle `supabase.auth.getUser()` calls — replace with `getCurrentUser()` from better-auth-session
4. Handle `supabase.rpc()` calls — replace with `db.rpc()` from D1 client
5. Delete 3 Supabase client files
6. Run `npm run build` + `npm test`

## Risk Assessment
- HIGH: Some Supabase queries may use Postgres-specific features (JSONB, arrays) not available in D1/SQLite
- MEDIUM: `supabase.storage` calls (file uploads) — D1 doesn't have storage. Check if R2 is already used.
- LOW: Type mismatches between Supabase auto-generated types and D1 query results

## Mitigation
- Scan for `.rpc()`, `.storage`, `.realtime` calls before migration
- Keep supabase/types.ts for reference
- Test each file after migration

---

## Completion Summary

**Completed:** 2026-04-14

- 112 files successfully migrated from Supabase client → D1 client
- 3 Supabase client files deleted (client.ts, admin.ts, server.ts)
- 4 OAuth callback files preserved (TikTok + YouTube OAuth token storage)
- All query patterns compatible with D1 builder syntax
- 844/844 tests passing
- Build clean with 0 errors
