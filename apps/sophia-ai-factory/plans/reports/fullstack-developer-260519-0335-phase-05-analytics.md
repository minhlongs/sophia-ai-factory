# Phase 05 Implementation Report — Analytics Error Handling

## Phase
- Phase: phase-05-analytics-error-handling
- Plan: plans/260519-0300-handover-funnel-critical-fixes/
- Status: completed

## Files Modified

| File | Change |
|------|--------|
| `src/app/[locale]/dashboard/analytics/page.tsx` | +14 lines — try/catch around Promise.all, loadError banner |
| `src/lib/analytics/rbac.ts` | +7 lines — try/catch around user_profiles query in checkAdmin |
| `src/app/[locale]/dashboard/analytics/error.tsx` | +9 lines — digest display, "Contact support" link to /dashboard/help |
| `messages/en.json` | +3 keys: `loadErrorBanner`, `errors.boundary.support`, `errors.boundary.errorCode` |
| `messages/vi.json` | +3 keys: same in Vietnamese |

## Where checkAdmin Was Found + How Hardened

`checkAdmin` is at `src/lib/analytics/rbac.ts:103`. It:
1. Calls `getUserTier(userId)` — returns MASTER → short-circuits true.
2. For non-MASTER users: does `createServerClient().from('user_profiles').select('role').eq('user_id', userId).single()`.

The `.single()` call throws when no row exists (D1 adapter behavior). BASIC users have NO `user_profiles` row because `migrations/0004-user-profiles.sql` creates the table but there is no auto-INSERT trigger and no INSERT in the signup flow.

Fix applied: wrapped the entire `createServerClient()` + D1 query block in `try { ... } catch { return false; }`. Fail-closed — missing row → not admin.

## Page Fix

`page.tsx` lines 77-80 changed from bare `const [userTier, isAdmin] = await Promise.all(...)` to:

```ts
let userTier: Tier = 'BASIC';
let isAdmin = false;
let loadError: string | undefined;
try {
  [userTier, isAdmin] = await Promise.all([getUserTier(user.id), checkAdmin(user.id)]);
} catch (err) {
  loadError = toError(err).message;
  logger.error('[Analytics] Failed to load tier/admin', toError(err));
}
```

Yellow alert banner rendered if `loadError` is set; page always renders (no more error boundary hit).

## Commit SHA

`03ce2b76` — pushed to `origin/main`

## Typecheck / Lint

- `npm run type-check` → 0 errors
- `npm run lint` → 341 warnings / 0 errors (baseline unchanged, 0 new)
- Pre-push hook: 4606 tests pass (461 files, 4572 tests)

## Follow-ups

1. **user_profiles not auto-created on signup** — `migrations/0004-user-profiles.sql` creates the table but no trigger or signup INSERT exists. BASIC users will always have no row. This means `checkAdmin` would have thrown on EVERY BASIC user call without this fix. Consider adding an auto-INSERT in the Better Auth `onUserCreated` hook (separate phase — not in scope here).
2. **error.tsx is shared-ish across all dashboard sub-routes** — adding "Contact support" link to `/dashboard/help` is fine for analytics; if a global error boundary exists it may need the same treatment in a future pass.
3. **loadErrorBanner translation key** — added only to `dashboard.analytics` namespace. If the yellow banner pattern is reused elsewhere, extract to `errors.` namespace (YAGNI — not done here).

## Unresolved Questions

- None for this phase. The `user_profiles` gap is documented in follow-up #1 above.
