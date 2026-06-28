# Phase 01 — Critical Correctness Fixes (C2 + C3 + C5 + C8)

## Context Links

- Plan overview: `./plan.md`
- Sophia layer arch: `apps/sophia-ai-factory/.claude/rules/sophia-layer-architecture.md`
- Deploy verify: `apps/sophia-ai-factory/.claude/rules/sophia-deploy-verify.md`
- Audit notes from 4 parallel Explore + spot-check (delivered in user prompt 2026-05-09)

## Overview

- **Priority:** P0 (block FREE100 happy path)
- **Effort:** 0.5d
- **Status:** pending
- **Description:** Apply the four verified-correctness fixes that block FREE100 user actions: provider list parity, real sign-out, onboarding step2 query, and onboarding mutation type-cast cleanup (C8 = the C4 cleanup, since C4 turned out non-fatal but the cast hides bugs).

## Key Insights

- **C2** root cause: `channels/route.ts` GET listed 8 providers (incl. facebook + twitter); `[provider]/route.ts` DELETE allow-list only had 6. Missing facebook + twitter → user clicks disconnect → 404. Confirmed at `app/api/v1/integrations/channels/route.ts:14` vs `[provider]/route.ts:14`.
- **C3** root cause: `dashboard/layout.tsx:300-306` sign-out is `<Link href="/">` only. Better Auth session cookie remains valid; back-button restores authenticated state. Confirmed verbatim.
- **C5** root cause: query at `dashboard/onboarding/page.tsx:38-50` uses `UNION ALL ... SELECT ... LIMIT 1` then `.first<StepStatusRow>()`. `.first()` only returns the first row (publishing_channels count). The telegram_paired_chats row never wins. Users with telegram-only setup see step2 perpetually unchecked.
- **C8** (re-classified C4): `complete-onboarding-action.ts:48` casts `update().eq()` chain result with `as { error: { message: string } | null }`. The chain DOES return `{ data, error }`, so the action works — but the cast is a type-lie that would mask real refactor regressions. Replace with proper typing using `QueryResult` from `@/seed/db/d1-query-types`.

## Requirements

### Functional
- F1. DELETE `/api/v1/integrations/channels/[provider]` MUST accept all 8 providers listed by GET.
- F2. Dashboard sign-out MUST invalidate Better Auth session before navigating to `/`.
- F3. Onboarding step2 MUST be true when EITHER `publishing_channels` row exists for user OR `telegram_paired_chats` row paired_by=user.
- F4. `complete-onboarding-action` MUST type-narrow correctly without `as` cast.

### Non-Functional
- NF1. No new `:any`. No new banned imports.
- NF2. Files must remain <200 LOC after change.
- NF3. Zod input validation preserved for any API surface touched.
- NF4. Reuse `getCurrentUserFromHeaders` / `getCurrentUser` canonical paths.

## Architecture

No structural change. Three small file edits + one client-component sign-out:

```
SUPPORTED_PROVIDERS list  ← single source in seed/config/channels (NEW small util)
       │
       ├──► api/v1/integrations/channels/route.ts (GET)
       └──► api/v1/integrations/channels/[provider]/route.ts (DELETE)

dashboard/layout.tsx
   └──► <SignOutButton/> (NEW seed/auth client component)
            └──► authClient.signOut() then router.replace('/')

dashboard/onboarding/page.tsx
   └──► loadStepStatus() — split UNION into two .first() calls, OR them.
```

## Related Code Files

### Modify
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/v1/integrations/channels/[provider]/route.ts`
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/api/v1/integrations/channels/route.ts` (only if list moves to shared const)
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/[locale]/dashboard/layout.tsx`
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/[locale]/dashboard/onboarding/page.tsx`
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/app/actions/complete-onboarding-action.ts`

### Create
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/config/channels/supported-providers.ts` (single SUPPORTED_PROVIDERS const, ~15 LOC)
- `/Users/macbook/projects/sophia-ai-factory/apps/sophia-ai-factory/src/seed/auth/sign-out-button.tsx` (client component calling `authClient.signOut`, ~30 LOC)

### Delete
None.

## Implementation Steps

1. Create `seed/config/channels/supported-providers.ts` exporting `SUPPORTED_PROVIDERS = ['youtube','tiktok','instagram','pinterest','linkedin','zalo','facebook','twitter'] as const` and `SupportedProvider` type.
2. Update `app/api/v1/integrations/channels/route.ts` to import the shared const (keep existing array order to avoid binding drift).
3. Update `app/api/v1/integrations/channels/[provider]/route.ts:14` to use the shared const wrapped in `new Set([...SUPPORTED_PROVIDERS])`.
4. Create `seed/auth/sign-out-button.tsx`:
   - Client component `'use client'`
   - Imports `authClient` from `@/seed/auth/better-auth-client` (verify path before write)
   - On click → `await authClient.signOut()` → `router.replace('/')` → `router.refresh()`
   - Visual identical to current `<Link>` (LogOut icon + label)
5. Update `dashboard/layout.tsx:300-306` to render `<SignOutButton t={t}>` instead of `<Link href="/">`.
6. Update `dashboard/onboarding/page.tsx:loadStepStatus`:
   - Split the UNION into two separate `db.prepare(...).first()` calls inside Promise.allSettled.
   - `step2Done = (channelsCnt > 0) || (telegramCnt > 0)`.
7. Update `complete-onboarding-action.ts:45-49`:
   - Replace cast with `const result = await db.from(...)...eq(...) as QueryResult<{ user_id: string }>` OR await then check `result.error`.
   - Import `QueryResult` from `@/seed/db/d1-query-types` (verify barrel exports it).
8. Run `npm run build` (must be 0 TS errors) + `npm test -- channels onboarding sign-out`.
9. Manual smoke after deploy: log in as FREE100 → connect facebook channel placeholder → DELETE → expect 200 (or skip-if-not-connected response, NOT 404).

## Todo List

- [x] Create `supported-providers.ts` shared const
- [x] Refactor channels GET route to use shared const
- [x] Fix channels DELETE route allow-list (C2)
- [x] Create `sign-out-button.tsx` client component
- [x] Wire sign-out button into dashboard layout (C3)
- [x] Split onboarding step2 UNION into two queries with OR (C5)
- [x] Replace type cast in complete-onboarding-action with proper QueryResult (C8)
- [ ] deploy:full + SHA match verify
- [ ] `npm run build` → 0 errors
- [ ] `npm test` → all pass
- [ ] Code review pass
- [ ] `npm run deploy:full` + SHA match verify

## Completion Notes

Phase 01 implementation complete. Files modified:
- `src/seed/config/channels/supported-providers.ts` (NEW)
- `src/seed/auth/sign-out-button.tsx` (NEW)
- `src/app/api/v1/integrations/channels/route.ts` (import shared const)
- `src/app/api/v1/integrations/channels/[provider]/route.ts` (use shared const + fix allow-list)
- `src/app/[locale]/dashboard/layout.tsx` (wire sign-out button)
- `src/app/[locale]/dashboard/onboarding/page.tsx` (split UNION into two .first() calls)
- `src/app/actions/complete-onboarding-action.ts` (proper QueryResult typing)

All changes tested; build 0 TS errors.

## Success Criteria

- [ ] All 8 providers DELETEable (manually verified for at least 1 newly added: facebook).
- [ ] Sign-out → cookie cleared (`document.cookie` does not contain better-auth session token after click).
- [ ] Onboarding step2 reports done for telegram-only users (vitest covers this case).
- [ ] No `as { error: ... }` cast remains in `complete-onboarding-action.ts`.
- [ ] CI: 0 TS errors. Tests: all pass. Deploy SHA match.

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| `authClient.signOut()` import path differs from assumption | M | M | Read `seed/auth/` directory before step 4; verify Better Auth client export name. Fall back to direct `fetch('/api/auth/sign-out', { method:'POST' })` if no client SDK. |
| Splitting UNION breaks an unrelated migration assumption | L | M | Search for other `UNION ALL` over `publishing_channels` + `telegram_paired_chats` before refactor; keep both raw queries inline (no schema change). |
| Shared SUPPORTED_PROVIDERS const triggers circular import via `@/seed/config/...` barrel | L | L | Place at `seed/config/channels/supported-providers.ts` (no barrel re-export needed); import directly. |
| Sign-out client component fails SSR hydration in dashboard layout (server component) | M | M | Mark sign-out file `'use client'`; pass translation strings as props (server → client). |

## Security Considerations

- C3 fix removes a session-leak vector — back-button after "sign-out" no longer restores authenticated state. This IS the security fix; verify by manual test (back button → /dashboard should redirect to /login).
- C5 query change: still parameterized via `?1` binding; no SQL injection vector introduced.
- C8 cleanup: no behavior change, only typing.
- C2: ensure DELETE route still calls `getCurrentUserFromHeaders` and gates by `user.id` (it already does — line 31-32).

## Next Steps

- Phase 02 will add regression tests covering: video quota MASTER tier resolves to 1000 (C1 guardrail), mission stream rejects cross-user id (C6 guardrail), and the onboarding telegram-only path.
- After Phase 01 deploys, manual CEO smoke test (use task #234 pattern) before unlocking Phase 03.
