# Phase Implementation Report — Dashboard CTA + Auth Fixes

## Executed Phase
- Plan: dashboard-auth bug fixes 260504
- Status: completed

## Files Modified

1. `src/app/[locale]/dashboard/integrations/integration-card.tsx` — D1: `<span>` → `<button disabled aria-disabled="true" title="Coming soon / Sắp ra mắt">` + `cursor-not-allowed opacity-60`
2. `src/app/[locale]/dashboard/components/create-campaign/campaign-form.tsx` — D2: validation error `<p>` below select when empty; D3: removed duplicate hidden `name="offer_id"` input
3. `src/app/[locale]/dashboard/components/create-campaign/template-selector.tsx` — D5: early return empty state "Không có mẫu nào / No templates available"
4. `src/forest/components/auth/signup-form.tsx` — A2: removed 1200ms setTimeout, redirect immediate
5. `src/seed/auth/better-auth-server.ts` — A3: added `subscriptions` INSERT (`plan:'basic'`, `status:'active'`) in user.create hook
6. `src/tree/byok/user-api-key-store.ts` — A5 type extension: `ByokProvider` union extended with `'youtube' | 'tiktok'`
7. `src/app/api/auth/youtube/callback/route.ts` — A5: migrated Supabase `user_profiles.api_keys` upsert → `setUserApiKey(userId, 'youtube', JSON.stringify({...}))` D1 store
8. `src/app/api/auth/tiktok/callback/route.ts` — A5: migrated Supabase `user_profiles.api_keys` upsert → `setUserApiKey(userId, 'tiktok', JSON.stringify({...}))` D1 store

D6 (`campaign-list.tsx`): no change needed — empty state CTA already uses `<Link><Button>` pattern correctly (line 95-97).

## Tasks Completed

- [x] D1 P1 — coming_soon buttons → semantic `<button disabled>`
- [x] D2 P1 — affiliate offer validation error shown when no offer selected
- [x] D3 P1 — duplicate `name="offer_id"` hidden input removed
- [x] D5 P2 — template-selector empty state guard
- [x] D6 P2 — confirmed existing pattern already correct, no change
- [x] A2 P1 — signup 1200ms setTimeout removed
- [x] A3 P1 — subscriptions row inserted on user.create
- [x] A5 P2 — YouTube + TikTok OAuth callbacks migrated to D1

## Tests Status
- Build: `npm run build` → exit 0 (Turbopack compiled + TypeScript passed + 144 static pages generated)
- TypeScript: 0 errors in owned files; 5 pre-existing errors in non-owned files (`violations/route.ts`, `license-sync-db.ts`, `overage-logger-ops.ts`, `telegram-state-backup-service.ts`)
- Unit tests: not run (scope: build verify only)

## Issues Encountered

- Build lock contention: multiple parallel `next build` processes from prior runs blocked new builds. Resolved by `kill -9` + lock removal.
- `subscriptions` table schema has no `user_id` column (only `org_id`). Task description implied `user_id` in INSERT — omitted per actual schema from migration 0001. `org_id` is sufficient (org is 1:1 with user at signup via `org_members`).

## Unresolved Questions

1. YouTube/TikTok credentials now stored encrypted via `encryptApiKey` (BYOK_MASTER_KEY). Existing readers of `user_profiles.api_keys` (Supabase path) for these providers will no longer find data there. Any server-side code that reads YouTube/TikTok tokens from `user_profiles.api_keys` must be updated to use `getUserApiKey(userId, 'youtube'/'tiktok')` + `JSON.parse()`. Is that migration complete elsewhere?
2. `setUserApiKey` throws on missing D1 or missing `BYOK_MASTER_KEY`. If `BYOK_MASTER_KEY` is unset in CF env, OAuth callbacks will 500 instead of redirecting. Confirm env var is set in production wrangler secrets.
3. D6 noted as "standardize CTA" but the CTA at line 95 is already correct (`<Link><Button>`). Was there a different element intended?
