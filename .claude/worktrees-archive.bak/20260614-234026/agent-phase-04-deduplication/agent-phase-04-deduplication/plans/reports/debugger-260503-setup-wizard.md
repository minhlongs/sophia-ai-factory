# Debugger Report: /setup-wizard Production Bug
Date: 2026-05-03
Commit under investigation: `2d057bc6` (deployed, confirmed via `/api/version`)

---

## Executive Summary

`/setup-wizard` redirects ALL unauthenticated visitors to `/login?redirect=/setup-wizard` (HTTP 307).
This is **correct behavior** for a visitor with no session cookie.
The bug is **NOT that the page 404s** — the i18n fixes in commits `3c1556e7` and `3d266c65` are deployed and structurally correct.

**Probable root cause (ranked):** The session cookie set by `/api/welcome/validate/[token]` (POST) after magic-link consumption is being rejected by `auth.api.getSession()`, so `getCurrentUser()` in `layout.tsx` returns `null` → redirect to login.

User flow breaking point: **welcome magic link → /setup-wizard** (not a direct cold visit).

---

## Evidence

### 1. Production SHA matches HEAD
```
/api/version: {"shortSha":"2d057bc6","deployedAt":"2026-05-03T11:39:48Z"}
git HEAD:      2d057bc6
```
All 6 fix commits are live. No stale deploy gap.

### 2. /setup-wizard 307 redirect without cookie
```
curl -I https://sophia.agencyos.network/setup-wizard
→ HTTP/2 307 → /login?redirect=/setup-wizard
```
Source: `apps/sophia-ai-factory/src/app/setup-wizard/layout.tsx:33`
```ts
const user = await getCurrentUser();
if (!user) { redirect("/login?redirect=/setup-wizard"); }
```

### 3. Middleware does NOT handle /setup-wizard
The middleware `matcher` explicitly **excludes** `/setup-wizard`:
```ts
matcher: ['/((?!api|_next|_worker|setup-wizard|auth/callback|.*\\..*).*)']
```
The 307 is fired by the Server Component layout, NOT middleware.
This is intentional — middleware only handles the reverse (dashboard → setup-wizard redirect when `wizard_done_<uid12>` cookie absent).

### 4. The i18n fix path looks correct
- `src/i18n.ts`: falls back to `'vi'` when `requestLocale` is absent (outside `[locale]` segment) — correct
- `layout.tsx`: reads `NEXT_LOCALE` cookie, defaults to `'vi'`, passes explicit locale to `getMessages({ locale })` — correct
- **BUT:** `NEXT_LOCALE` cookie is **never explicitly set anywhere** in the codebase. It is presumably set by `next-intl` middleware's `localePrefix: 'as-needed'` + `defaultLocale: 'en'`. Brand-new users who land directly on `/setup-wizard` via magic-link (no prior locale visit) will have no `NEXT_LOCALE` cookie → locale defaults to `'vi'` — this is non-fatal fallback.

### 5. Cookie name mismatch risk in welcome flow
Commit `08305050` fixed `better-auth.session_token` → `__Secure-better-auth.session_token` for https.
Current code (deployed) uses:
```ts
const baseUrl = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network';
const isHttps = baseUrl.startsWith('https://');
const cookieName = `${isHttps ? '__Secure-' : ''}better-auth.session_token`;
```
**Risk:** If `BETTER_AUTH_URL` or `NEXT_PUBLIC_APP_URL` are NOT set as Wrangler secrets (they are not in `wrangler.jsonc`), the fallback hardcodes `https://sophia.agencyos.network` → `isHttps = true` → correct name used. This path is safe.

**However:** Better Auth itself does NOT configure `cookiePrefix` in `better-auth-server.ts`. Better Auth auto-prefixes `__Secure-` based on whether the request is HTTPS — not based on `baseURL`. The manual cookie name construction in `/api/welcome/validate` could still diverge from what Better Auth reads if Better Auth uses a different heuristic.

### 6. Cookie signing correctness
`signCookieValue(token, secret)` produces: `encodeURIComponent(token + '.' + base64(HMAC-SHA256(token, secret)))`
Better Auth's `better-call/crypto.mjs` uses: same scheme.
This part appears correct — but **untestable without a live session** from the terminal.

### 7. Session `cookieCache` TTL
```ts
session: { cookieCache: { enabled: true, maxAge: 5 * 60 } }
```
If cache is stale and D1 lookup fails (network error, cold start), `getSession()` may return null. Middleware has try/catch → falls to `/login`. Layout has no catch — throws → Next.js catches → 307. Could be a transient D1 cold start.

---

## Reproduction Steps

1. Admin creates a handover, sends magic-link to customer
2. Customer clicks magic-link → `POST /api/welcome/validate/{token}` → sets `__Secure-better-auth.session_token` cookie
3. Response body: `{ success: true, redirectUrl: '/setup-wizard' }`
4. Client JS redirects to `/setup-wizard`
5. Browser sends request with session cookie
6. `layout.tsx` calls `getCurrentUser()` → `auth.api.getSession()`
7. If session cookie rejected/not found → `user = null` → `redirect('/login?redirect=/setup-wizard')` ← **BUG**

Cold-visit path (user not from magic-link):
1. User goes to `https://sophia.agencyos.network/setup-wizard` with NO session cookie
2. Gets 307 to `/login` — this is **correct behavior**, not a bug

---

## Root Cause Hypotheses (ranked by likelihood)

### H1 (HIGH) — `__Secure-` cookie not sent back by browser after magic-link
The manual `Set-Cookie` in `/api/welcome/validate` sets `Secure; SameSite=Lax`.
If the `__Secure-` prefix cookie is not being persisted by the browser (e.g., domain mismatch, or the response redirect happens before the browser stores the cookie), the subsequent GET to `/setup-wizard` carries no session cookie.
**Evidence:** All fix commits address this flow. Commit `3b7f7780` added HMAC signing (previously session was rejected). Fix was recent (same day).

### H2 (MEDIUM) — Better Auth `__Secure-` heuristic differs from manual construction
Better Auth determines the `__Secure-` prefix from the incoming HTTP request's protocol (via `x-forwarded-proto` or direct TLS), NOT from `baseURL`. In Cloudflare Workers, the request arrives as HTTPS. The manual code uses `baseURL.startsWith('https://')` which is equivalent — but if BETTER_AUTH_URL is set to something unexpected, this could diverge.
**Evidence:** No `BETTER_AUTH_URL` in `wrangler.jsonc` vars block (only `NEXT_PUBLIC_IS_CONFIGURED` and `IS_CONFIGURED`). Value comes from Cloudflare Secrets or falls back to hardcoded default.

### H3 (MEDIUM) — D1 cold start / `getD1()` resolution fails in layout
`better-auth-server.ts::getD1()` reads from `globalThis.__env?.DB`, then `__cloudflare-context__`, then `globalThis.__D1_DB`. If D1 binding is not available during SSR (cold Worker start), `getAuth()` throws → `getSession()` catches → returns null → layout redirects to login.
**Evidence:** Layout's `getCurrentUser()` has try/catch that returns null on ANY error (silently). No logging in the catch block means this failure is invisible.

### H4 (LOW) — `NEXT_LOCALE` cookie absent causing `getMessages()` crash
If `getMessages({ locale: 'vi' })` crashes (e.g., missing translation key), the layout throws before reaching `redirect()`. Would manifest as 500 or 404, not 307.
**Evidence:** i18n fix commits `3c1556e7` and `3d266c65` address this. `i18n.ts` has proper fallback. Unlikely but possible if `messages/vi.json` is missing a key used in `setupWizard.*` namespace.

---

## Files Involved

| File | Role |
|------|------|
| `src/app/setup-wizard/layout.tsx` | Auth gate — redirects to login if `getCurrentUser()` null |
| `src/app/setup-wizard/page.tsx` | Wizard UI — uses `useTranslations('setupWizard')` |
| `src/app/api/welcome/validate/[token]/route.ts` | Mints session cookie after magic-link consumption |
| `src/lib/better-auth-server.ts` | Better Auth config — no `cookiePrefix` set, uses `__Secure-` auto-detection |
| `src/lib/better-auth-session.ts` | `getCurrentUser()` helper — try/catch returns null silently |
| `src/lib/auth/sign-cookie-value.ts` | HMAC signing — correct scheme |
| `src/middleware.ts` | **Does NOT run for /setup-wizard** (excluded from matcher) |
| `src/i18n.ts` | Falls back to `'vi'` when no locale in request — correct |

---

## Recommended Fix Actions (do NOT implement yet)

### Fix 1 (critical) — Add server-side logging in layout.tsx catch
Add `logger.error('[Setup Layout] getSession failed', err)` inside the layout's auth guard catch block. This will surface the exact failure reason (D1 unavailable, cookie rejected, etc.) in Cloudflare Workers logs.

### Fix 2 (critical) — Verify Better Auth's actual cookie name via Workers log
After Fix 1 is deployed, check `wrangler tail` output for cookie-related errors. Alternatively, inspect the Set-Cookie header returned by `POST /api/welcome/validate/{token}` in browser DevTools Network tab — confirm `__Secure-better-auth.session_token` is present and the value matches the signed format.

### Fix 3 (medium) — Add `BETTER_AUTH_URL` as explicit Wrangler secret
Ensure `BETTER_AUTH_URL=https://sophia.agencyos.network` is set via `wrangler secret put BETTER_AUTH_URL` so the hardcoded fallback is never reached. Reduces risk of H2.

### Fix 4 (medium) — Fallback to login with error param, not silent redirect
In `layout.tsx`, instead of `redirect("/login?redirect=/setup-wizard")` on auth failure, add `?error=session_expired` to help users understand why they were redirected.

### Fix 5 (low) — Check `messages/vi.json` has all `setupWizard.*` keys
Run `grep -r "t('setupWizard" src/app/setup-wizard/ | sort -u` and verify every key exists in `messages/vi.json` and `messages/en.json`.

---

## Risk: Blast Radius if Fix is Wrong

- Fix 1 (logging only): zero blast radius — read-only change
- Fix 2 (cookie name): if wrong name used, all magic-link sessions stop working → users locked out. Must test in staging or with `wrangler dev --remote`
- Fix 3 (Wrangler secret): safe, additive
- Fix 4 (error param): safe, UX only
- Fix 5 (translation keys): safe, additive

---

## Verification Plan Post-Fix

1. Admin creates test handover, sends magic link to test email
2. Click magic link → confirm `POST /api/welcome/validate/{token}` returns 200 + sets `__Secure-better-auth.session_token` in browser DevTools
3. Confirm browser redirects to `https://sophia.agencyos.network/setup-wizard` and page LOADS (not 307 to login)
4. Complete wizard steps → confirm `/api/setup/save` returns success + sets `wizard_done_<uid12>` cookie
5. Redirect to `/dashboard` → confirm no redirect loop back to wizard
6. `wrangler tail` should show NO `[Setup Layout] getSession failed` errors

---

## Unresolved Questions

1. **What does the user mean by "không hoạt động"?** — Is it the 307 redirect (unauthenticated visit) or something specific to the magic-link flow? If user tested with a real browser session, the page should have loaded. Need repro steps from user.
2. **Were `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` set as Cloudflare Workers secrets before or after the relevant fix commits?** If `BETTER_AUTH_SECRET` was absent, ALL sessions would fail silently.
3. **Is `wrangler tail` accessible to check live logs?** This would definitively identify H1 vs H3.
4. **next-intl version discrepancy:** `package.json` says `^4.8.2` but lockfile resolves `3.26.5`. This likely means the workspace root's lockfile has an old resolution. Should confirm the actual installed version matches what the i18n fix assumes (v3 API = `getMessages({ locale })` which is valid in v3).
