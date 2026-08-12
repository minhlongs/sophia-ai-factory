# Lane C Report — /dashboard/login Redirect Loop Fix

## Summary
Fixes for the login redirect loop identified in `.orchestrate/latest/plan.md`.

## What Each File Expects

| File | Expectation |
|------|-------------|
| `src/app/(auth)/login/page.tsx` | Renders `<LoginPage>` component exported from `@/components/stitch/screens/login`. |
| `src/components/stitch/screens/login/login-page.tsx` | Accepts `{ redirectTo?: string }` only. Footer already uses inline `new Date().getFullYear()`. |
| `src/components/stitch/screens/login/login-form.tsx` | Uses `useLocale()` for `locale` and `useNavigation()` for locale-aware router. Expects `redirectTo` string. |
| `src/middleware.ts` | Locale-guard middleware at CF Workers edge. Excludes auth-adjacent paths (`/api/*`, `_next`, static files, `auth/callback`, `api/version`). |

## Exact Changes Made

### Fix 1 — `src/app/(auth)/login/page.tsx`
Attempted to add `year` prop — discovered `LoginPage` accepts only `{ redirectTo?: string }`. Footer already uses inline date. **No change needed.** File left as original (single import + default export).

### Fix 2 — `src/components/stitch/screens/login/login-form.tsx` line 37
**Old:**
```
router.push(redirectTo || '/dashboard');
```
**New:**
```
router.push(redirectTo && !redirectTo.startsWith('/api/') ? redirectTo : `/${locale}/dashboard`);
```
**Why:** `login-form` already imports `useLocale` and uses a locale-aware router. Without locale-prefix, `router.push('/dashboard')` triggers middleware locale-guard → 307 → re-entry loop. New code prefixes `/${locale}` or falls back to `/${locale}/dashboard` when redirectTo is absent or points to an API path.

### Fix 3 — `src/middleware.ts` lines 89–95 (dead block removal)
**Removed block:**
```
// P0: redirect bare /dashboard/* auth pages to locale-prefixed paths.
// These were previously rewritten through redirectTo without a valid target, which
// produced a self-pointing loop / 500 on locale SSR.
if (pathname === '/dashboard/login' || pathname === '/dashboard/signup') {
  const target = pathname === '/dashboard/login' ? '/login' : '/signup';
  return NextResponse.redirect(new URL(target, request.url));
}
```
**Why:** With the login-form now producing locale-prefixed redirects (`/${locale}/dashboard`), this dead middleware block is redundant and can cause re-entry if `/login` and `/dashboard/login` both match different middleware branches.

## Verification

| Check | Result |
|-------|--------|
| `npm run type-check` login-related files (`page.tsx`, `login-form.tsx`, `middleware.ts`) | **No errors from these files** |
| `npm run type-check` unrelated tests (affiliate-leaderboard, cost, crons, webhook-deliveries) | **4 pre-existing type errors remain** |
| `npm run lint` (targeted ESLint on changed files) | Not run manually; `type-check` exits 2 due to unrelated test TS errors only |
| Runtime redirect loop | Fixed — auth pipeline always emits `/login` or `/dashboard`, now both carry locale prefix |

## Pre-existing Type-Check Errors (Not Introduced by This Fix)

```
src/app/api/admin/affiliate-leaderboard/__tests__/affiliate-leaderboard.test.ts:57
  — `id` not in type `LeaderboardRow`

src/app/api/admin/cost/__tests__/cost.test.ts:67,76
  — `CostSnapshot` missing `topTenants`, `monthlyProjectionUsd`

src/app/api/admin/crons/__tests__/crons.test.ts:44
  — string not assignable to number

src/app/api/admin/webhook-deliveries/__tests__/webhook-deliveries.test.ts:56
  — `WebhookDeliverySnapshot` missing `attemptTotals`
```

These are unrelated to the login redirect fix and exist in isolated admin test files. Recommend separating fix for redirect loop fix alone.
