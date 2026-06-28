# Phase 02 — Setup-wizard locale routing

## Context Links
- Audit: `plans/reports/ui-ux-designer-260519-0240-dashboard-usability.md` §Flow 2, screenshots `03-wizard-step-1.png`–`06-onboarding-page.png`
- Existing wizard component: `src/app/[locale]/setup-wizard/page.tsx` (intact, renders correctly when reached)
- Wizard layout: `src/app/[locale]/setup-wizard/layout.tsx` (auth-gated, redirects to `/${locale}/login` if no session)
- Middleware: `src/middleware.ts` (lines 84-89, 161)
- Protected flow rule: `.claude/rules/sophia-handover-rules.md` — Setup Wizard is non-breakable.

## Overview
- Priority: 🔴 Critical
- Status: pending
- `/setup-wizard` (no locale prefix) serves marketing landing page instead of the wizard. Middleware redirects `/dashboard` → `/setup-wizard` (line 88) when `IS_CONFIGURED !== 'true'`. Welcome flow also redirects to `/setup-wizard` (see Phase 03).

## Key Insights
- Wizard component at `src/app/[locale]/setup-wizard/page.tsx` is functional and well-tested.
- `next-intl` is configured with `localePrefix: 'as-needed'` (middleware.ts:37) — meaning `/setup-wizard` should map to default locale (`en`) wizard route.
- Middleware line 161: `if (pathname.startsWith('/api') || pathname.startsWith('/setup-wizard'))` — this branch **skips** the intl middleware locale rewrite for `/setup-wizard`. The branch attaches CSP headers and returns — but does NOT call `intlMiddleware()` to rewrite to `/en/setup-wizard`.
- Result: `/setup-wizard` falls through to root catch-all → marketing landing.
- Fix: remove the `/setup-wizard` short-circuit so it goes through intlMiddleware OR explicitly rewrite to `/${defaultLocale}/setup-wizard`.

## Requirements
- `/setup-wizard` → renders the actual wizard (not marketing).
- `/en/setup-wizard` and `/vi/setup-wizard` continue to render the wizard.
- Middleware still attaches CSP + nonce for wizard route (see comment block at lines 217-222 — past CSP regression).
- Auth gate in `layout.tsx` still enforces login redirect for unauth users.

## Architecture
- Layer: **middleware (seed/security-adjacent) + app routes**.
- Pattern: let intl middleware handle locale rewrite; keep CSP nonce attachment.
- Touch: `src/middleware.ts` only — wizard page itself is fine.

## Related Code Files
- Modify: `src/middleware.ts` (lines 84-89 — also the unconfigured-redirect block must use locale-aware path)
- Reference (no change): `src/app/[locale]/setup-wizard/page.tsx`, `src/app/[locale]/setup-wizard/layout.tsx`
- Reference: `src/app/[locale]/dashboard/onboarding/page.tsx` (audit notes this works — keep as-is, may be the canonical wizard alias)

## Implementation Steps
1. Open `src/middleware.ts`. Identify two issues:
   - Line 88: `NextResponse.redirect(new URL('/setup-wizard', request.url))` — should use locale-aware path. Read locale from cookie (`NEXT_LOCALE`) or from the stripped pathname.
   - Line 161-190: the branch that handles `/setup-wizard` directly returns without intl rewrite.
2. Refactor middleware so `/setup-wizard` (no locale) is treated like any other public page:
   - Move CSP + usage-event emission to a shared helper (or keep inline) so it runs for both locale-prefixed and unprefixed paths.
   - Remove the `pathname.startsWith('/setup-wizard')` short-circuit from line 161 condition — keep only `/api`.
   - Let `intlMiddleware(request)` handle the rewrite to `/en/setup-wizard` or `/vi/setup-wizard`.
3. For the dashboard-unconfigured redirect at line 88:
   - Determine current locale from request (cookie or pathname).
   - Redirect to `new URL(`/${locale}/setup-wizard`, request.url)` to preserve UX locale.
4. Add inline comment explaining why `/setup-wizard` must go through intl middleware (link to this plan + audit screenshots).
5. Add E2E test: `tests/e2e/setup-wizard-routing.spec.ts`:
   - Hit `/setup-wizard` unauthenticated → 302 to `/${locale}/login`
   - Hit `/en/setup-wizard` authenticated → 200, find `data-testid="setup-wizard-root"`
   - Hit `/vi/setup-wizard` authenticated → 200, see Vietnamese wizard title
6. Build + run existing wizard tests (`tests/e2e/setup-wizard*.spec.ts`) to confirm no regression.

## Todo List
- [ ] Remove `/setup-wizard` short-circuit from middleware line 161
- [ ] Move CSP + usage event logic into helper (or inline before intl rewrite)
- [ ] Locale-aware redirect for unconfigured dashboard → wizard (line 88)
- [ ] Add E2E test for `/setup-wizard` (no locale) → wizard renders
- [ ] Existing wizard tests pass
- [ ] Build passes (`npm run build`)

## Success Criteria
```ts
test('setup wizard reachable at /setup-wizard with no locale', async ({ page, context }) => {
  // Pre-authenticate
  await page.goto(`${PROD_URL}/api/auth/sign-up/email`, { method: 'POST', /* ... */ });
  const res = await page.goto(`${PROD_URL}/setup-wizard`);
  expect(res?.status()).toBe(200);
  await expect(page.locator('[data-testid="setup-wizard-root"]')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/welcome|chào mừng/i);
});
```

## Risk Assessment
- **HIGH risk** — middleware is shared by all routes. Changes can cascade.
- Specific regression risks:
  - Locale cookies dropped during rewrite → user sees wrong language
  - CSP nonce not attached on `/setup-wizard` → React bootstrap blocked (the very bug the comment at line 217-222 fixed last time)
  - Usage event emission lost for wizard pageviews
- Mitigation: write the E2E test FIRST (TDD), then refactor middleware.
- Validate against: `tests/e2e/setup-wizard*.spec.ts`, `tests/e2e/handover-journey-260519.spec.ts`.

## Security Considerations
- CSP nonce MUST still be attached — verify via response header inspection in E2E test.
- CSRF cookie seeding still occurs for GET requests (existing behavior at line 75-77 must remain).
- Open-redirect: ensure the locale-aware redirect at line 88 cannot be hijacked (only writes `/${locale}/setup-wizard` — locale validated against `['en','vi']`).

## Dependencies
- None. Can be done before Phase 03 (and Phase 03 will rely on `/setup-wizard` working).
- Block Phase 03 until this passes.

## Unresolved Questions
1. **Is `/setup-wizard` the canonical onboarding URL, or is `/dashboard/onboarding`?** Audit observed `/dashboard/onboarding` works correctly. Per `sophia-handover-rules.md` "Setup Wizard" is the protected flow but the canonical URL is ambiguous. Operator: pick one and unify (recommend `/dashboard/onboarding` as canonical, `/setup-wizard` as alias OR vice-versa).
2. Should we rename welcome-tour modal references to point at whichever URL we make canonical?
3. `IS_CONFIGURED` env var (line 84) — is it intended to be per-user (DB lookup) or per-deployment (env)? Currently it's a global env — means once any one user finishes wizard, NEW signups bypass wizard redirect. Bug or feature?
