# Phase 03 — Magic link session + redirect

## Context Links
- Audit: `plans/reports/tester-260519-0240-handover-journey-specs.md` §Journey 2, Bug #2 (HIGH severity)
- Welcome client: `src/app/[locale]/welcome/[token]/welcome-page-client.tsx`
- Welcome API: `src/app/api/welcome/validate/[token]/route.ts` (POST handler — lines 97-194)
- Better Auth session util: `src/seed/auth/sign-cookie-value.ts`
- Better Auth server: `src/seed/auth/better-auth-server.ts` (defines `useSecureCookies` pattern)

## Overview
- Priority: 🔴 Critical (blocks the entire FREE100 → MASTER → dashboard handover flow)
- Status: pending
- After magic link redemption, user is redirected to `/vi/login` instead of dashboard. Session cookie isn't reaching the subsequent request (or it's set but the redirect URL is broken).

## Key Insights
- POST `/api/welcome/validate/[token]/route.ts` line 147 returns `redirectUrl: '/setup-wizard'` (NO locale prefix).
- This depends on Phase 02 — without the locale-routing fix, `/setup-wizard` falls through to marketing page.
- Cookie is set at lines 159-185 — code looks correct but worth verifying:
  - Cookie name: `__Secure-better-auth.session_token` in production
  - Path: `/`, HttpOnly, Secure (in prod), SameSite=Lax
  - Signed with `BETTER_AUTH_SECRET`
- Client at `welcome-page-client.tsx:57` uses `window.location.href = data.redirectUrl ?? \`/${locale}/dashboard\`` — this is a full page navigation that SHOULD carry cookies.
- Locale slip: client request to `/api/welcome/validate/<token>` doesn't include locale; the response redirectUrl `/setup-wizard` is unprefixed; browser navigation to `/setup-wizard` may then redirect via intl middleware to `/vi/setup-wizard` (Accept-Language) — and if Phase 02 isn't yet fixed, marketing page renders.
- Better Auth session creation via `ctx.internalAdapter.createSession` is the recommended approach for Better Auth (verified pattern). The session DOES exist in DB if `internalAdapter` returns a token.

## Requirements
- Magic link consume → session cookie set on response
- Subsequent navigation to `redirectUrl` carries cookie and lands on **either** `/[locale]/setup-wizard` (Phase 02 working) OR `/[locale]/dashboard` (if user already configured)
- No redirect chain to `/login`
- Audit log entries for `customer_handover_consumed` + `customer_handover_session_created` preserved
- Rate limiting (10 req/min/IP) preserved

## Architecture
- Layer: **app/api (route handler) + minor tree handover update**
- Pattern: server returns absolute locale-aware redirect URL; client preserves locale; cookie set BEFORE redirect; assert in E2E that cookie present on dashboard request

## Related Code Files
- Modify: `src/app/api/welcome/validate/[token]/route.ts`
  - Line 147: build locale-aware redirect URL
  - Lines 150-191: verify session creation works under CF Workers runtime
- Modify: `src/app/[locale]/welcome/[token]/welcome-page-client.tsx` (line 55-60)
  - Pass `locale` in API request body OR read locale from current URL
- Reference: `src/seed/auth/better-auth-server.ts` — useSecureCookies logic
- Reference: `src/seed/auth/sign-cookie-value.ts` — cookie signing
- Add: `tests/e2e/welcome-magic-link.spec.ts` (already exists likely — extend)

## Implementation Steps
1. **Determine locale in API route**. Options (pick one):
   - **A (preferred)**: Read `Accept-Language` header or `NEXT_LOCALE` cookie inside the POST handler. Build `redirectUrl = \`/${locale}/setup-wizard\``. Validates against `['en','vi']`.
   - **B**: Accept `{locale}` field in POST body from client. Client reads `useLocale()` from next-intl and includes in fetch body.
   - Recommendation: **B** — explicit, no header parsing.
2. Update `welcome-page-client.tsx` line 55:
   ```ts
   const res = await fetch(`/api/welcome/validate/${token}`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ locale }),
   });
   ```
3. Update `route.ts` POST handler:
   - Parse `{ locale }` from request body (default `'en'`, allow only `['en','vi']`)
   - Build `redirectUrl = \`/${safeLocale}/setup-wizard\``
   - Return `{ success: true, redirectUrl }`
4. Verify session cookie set BEFORE `redirect` happens:
   - Current code at lines 145-193 calls `NextResponse.json(...)` then mutates headers — confirm `Set-Cookie` is in the response object that client receives.
   - Confirm browser respects `Set-Cookie` on a fetch response (it should, with `credentials: 'include'` — but fetch defaults are `same-origin` which is fine here).
   - If client uses `window.location.href` after fetch resolves, cookie IS available for the next request (browser stores it as soon as the response arrives).
5. Verify Better Auth `internalAdapter.createSession`:
   - Run `npm test -- welcome-magic-link` (if test exists)
   - Add unit test: mock D1, assert session row created
6. Test in dev with a real D1 record:
   - Seed a handover via SQL or test fixture
   - Hit `/en/welcome/<token>`, click "Get Started"
   - Verify `Set-Cookie` header in network panel
   - Verify navigation to `/en/setup-wizard` (or `/en/dashboard` if already configured)
   - Verify subsequent dashboard request includes cookie
7. Update E2E test in `tests/e2e/handover-journey-260519.spec.ts` Journey 2 — add explicit cookie assertion after magic link consumption.

## Todo List
- [ ] Client passes `locale` in POST body to `/api/welcome/validate/<token>`
- [ ] Server returns locale-aware `redirectUrl`
- [ ] Locale whitelist validation (`['en','vi']`)
- [ ] Verify `Set-Cookie` header present in POST response
- [ ] Unit test for session creation (mock D1)
- [ ] E2E test confirms cookie → dashboard reachable without re-login
- [ ] Run existing `tests/e2e/handover-journey-260519.spec.ts` Journey 2 — PASSES (not skip)
- [ ] Audit logs still written

## Success Criteria
```ts
test('Journey 2 — FREE100 redeem → magic link → dashboard reached', async ({ page, request }) => {
  const promo = await request.post('/api/promo/redeem-free', { data: { code: 'FREE100', email: 'test@example.com' } });
  const { magicLinkUrl } = await promo.json();
  await page.goto(magicLinkUrl); // /en/welcome/<token>
  await page.getByRole('button', { name: /get started/i }).click();
  await page.waitForURL(/\/(en|vi)\/(setup-wizard|dashboard)/);
  // CRITICAL: assert no redirect to /login
  expect(page.url()).not.toMatch(/\/login/);
  // Cookie should be present
  const cookies = await page.context().cookies();
  expect(cookies.find(c => c.name.includes('better-auth.session_token'))).toBeDefined();
});
```

## Risk Assessment
- **Medium-high risk**. Auth flow change.
- Session cookie format must match Better Auth's expected signing (verify `signCookieValue` matches what Better Auth reads on subsequent requests).
- If `internalAdapter.createSession` API changes in future Better Auth versions, this breaks. Add type guards and warn-log on failure.
- CF Workers cookie behavior: `__Secure-` prefix requires HTTPS — ensure dev env uses `useSecureCookies=false` properly.
- Rate limit (10/min/IP) protects against brute-force but may interfere with E2E test reruns — add retry/backoff in test.

## Security Considerations
- Token is consumed BEFORE session creation (line 117) — race-safe via `consumeMagicLink(handover.id, token)` returning false on already-consumed. Good.
- Locale param validation MUST whitelist — never reflect arbitrary string back as URL component.
- Audit log writes are async but should not be skipped — keep `await writeAuditLog(...)` calls.
- Hash-of-email logged (line 133) — preserve PII protection.

## Dependencies
- **Phase 02 MUST complete first**. Without locale-routing fix, `redirectUrl=/<locale>/setup-wizard` will still land on marketing page if user hits `/setup-wizard` (no prefix). Phase 02 fixes the no-prefix case; this phase ensures we always send prefix.

## Unresolved Questions
1. **What's the canonical post-handover destination?** Currently `/setup-wizard`. Should it be `/dashboard/onboarding` (the working URL)? Or check if user has API keys configured and pick? Operator decision.
2. **Should we extend rate limit to be per-token-not-IP** for E2E test stability? Current 10/min/IP blocks rapid retries.
3. **Better Auth version pinning** — is `internalAdapter` part of stable public API or did we tap into private internals? Check `package.json` dep version + Better Auth docs.
4. **Email verification gate** — audit notes fresh users land on dashboard without verifying email. Magic-link users skip this entirely (by design — magic link IS verification). Confirm this matches `sophia-handover-rules.md` intent.
