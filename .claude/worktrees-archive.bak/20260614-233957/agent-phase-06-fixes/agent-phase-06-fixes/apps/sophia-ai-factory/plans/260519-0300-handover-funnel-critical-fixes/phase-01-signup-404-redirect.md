# Phase 01 — Signup 404 redirect

## Context Links
- Audit: `plans/reports/ui-ux-designer-260519-0240-dashboard-usability.md` §Flow 1, screenshot `01-signup-or-login-page.png`
- Existing login page: `src/app/[locale]/login/page.tsx` (already has Sign In + Sign Up tabs)
- Signup form component: `src/forest/components/auth/signup-form.tsx`

## Overview
- Priority: 🔴 Critical
- Status: pending
- `/en/auth/signup` and `/vi/auth/signup` return Next.js default 404. No Sophia branding, no nav. New customers can't reach signup at advertised URL.

## Key Insights
- `src/app/[locale]/auth/` exists with only `mfa-challenge/` subdir — NO `signup/` subdir.
- Canonical signup UX lives at `/[locale]/login` with `pageTab="signup"` state (set via tab switcher).
- Login page accepts `?coupon=`, `?tier=`, `?redirect=` query params.
- Simplest fix: create a tiny page that redirects to `/login?tab=signup` and forwards query params.

## Requirements
- `/en/auth/signup` and `/vi/auth/signup` return HTTP 200 (not 404).
- User lands on the existing login page with Sign Up tab pre-selected.
- Query params (coupon, tier, redirect) forwarded.
- No new UI surface — DRY, reuses login page.

## Architecture
- Layer: **app routes only** (no seed/tree/forest/land change).
- Pattern: new `page.tsx` under `src/app/[locale]/auth/signup/` that calls `redirect()` server-side.
- Locale-aware: redirect target includes the locale segment.

## Related Code Files
- Create: `src/app/[locale]/auth/signup/page.tsx`
- Reference: `src/app/[locale]/login/page.tsx` (line 44 — `pageTab` state)
- Reference: `src/middleware.ts` (verify locale stripping works for new route)

## Implementation Steps
1. Create `src/app/[locale]/auth/signup/page.tsx`:
   - Server component (`async function`)
   - Accept `params: Promise<{ locale: string }>` and `searchParams: Promise<Record<string, string | string[]>>`
   - Build redirect URL: `/${locale}/login?tab=signup` + forward existing query string
   - Call `redirect(url)` from `next/navigation`
2. Update login page (`src/app/[locale]/login/page.tsx`):
   - Read `?tab=` query param on mount (already uses `useSearchParams`)
   - If `tab === 'signup'`, set `pageTab` initial state to `"signup"`
3. Verify Next.js builds the route (no conflict with `[locale]/auth/mfa-challenge`).
4. Build + test locally — visit `/en/auth/signup?coupon=FREE100` → should land on `/en/login?tab=signup&coupon=FREE100`.

## Todo List
- [ ] Create `src/app/[locale]/auth/signup/page.tsx`
- [ ] Update login page to read `?tab=signup` query param
- [ ] Build passes (`npm run build`)
- [ ] Manual test EN + VI locale
- [ ] Manual test query forwarding (`?coupon=FREE100&tier=master`)

## Success Criteria
Playwright assertion:
```ts
const res = await page.goto('https://sophia.agencyos.network/en/auth/signup');
expect(res?.status()).toBeLessThan(400);
expect(page.url()).toMatch(/\/login.*tab=signup/);
await expect(page.getByRole('heading', { name: /sign ?up/i })).toBeVisible();
```

## Risk Assessment
- Low risk. Pure additive change.
- Possible: locale fallback (`localePrefix: 'as-needed'`) may strip `/en` from URL — verify both `/auth/signup` and `/en/auth/signup` work after deploy.
- No risk to protected flows (Setup Wizard, Telegram, NOWPayments untouched).

## Security Considerations
- Forward query params with care: only whitelist known params (`coupon`, `tier`, `redirect`). Reject open-redirect attempts in `?redirect=` (existing login page should already validate, but verify).
- No new auth surface introduced.

## Dependencies
- None. Can run first or in parallel with Phase 02, 04, 05.

## Unresolved Questions
1. Should we ALSO add `/en/signup` (no `/auth/` prefix) as alias? UX research suggests yes — common pattern. Operator decision needed.
2. Should welcome-tour modal link be updated to point at the new URL? (Tour modal currently references some URL — verify in `src/app/[locale]/dashboard/components/welcome-tour.tsx`.)
