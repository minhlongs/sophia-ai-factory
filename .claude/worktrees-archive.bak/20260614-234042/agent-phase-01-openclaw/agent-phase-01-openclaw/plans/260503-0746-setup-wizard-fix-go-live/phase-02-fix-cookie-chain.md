# Phase 02 — Fix Cookie Chain (Magic-Link → Better Auth Session)

## Context Links

- Debugger §H1-H2: [`../reports/debugger-260503-setup-wizard.md`](../reports/debugger-260503-setup-wizard.md)
- Phase 01 logs (prerequisite for confirming hypothesis)

## Overview

- **Priority:** P0 (BLOCKER for go-live)
- **Status:** ✅ complete
- **ETA:** 90m
- **Brief:** Align manual cookie minting in `/api/welcome/validate/[token]` with Better Auth's expectations. Set explicit `cookiePrefix`, verify Wrangler secrets, ensure HMAC signing matches.

## Key Insights

- `better-auth-server.ts` does NOT set `cookiePrefix` → Better Auth auto-detects from request protocol
- `/api/welcome/validate/[token]/route.ts` manually constructs cookie name from `BETTER_AUTH_URL` env
- Risk of divergence: if Better Auth uses request `x-forwarded-proto` but env var is missing/wrong → 2 different prefixes
- Wrangler `vars` block contains only `NEXT_PUBLIC_IS_CONFIGURED`, `IS_CONFIGURED` — `BETTER_AUTH_URL` must be a **secret** (not a var)
- Better Auth `cookieCache` TTL = 5 min — even after fix, stale cache could mask success briefly

## Requirements

**Functional:**
- Cookie minted by `/api/welcome/validate/[token]` is READABLE by `auth.api.getSession()` on next request
- Cookie name, signing scheme, attributes (Secure, HttpOnly, SameSite, Path, MaxAge) match Better Auth exactly
- Magic-link → /setup-wizard works in production

**Non-functional:**
- No regression for normal email/password login flow
- No regression for `wizard_done_<uid12>` cookie middleware logic
- 0 `:any` types

## Architecture

```
POST /api/welcome/validate/[token]
  → verify token + load user
  → CALL Better Auth admin API to create session
     OR
  → manual mint: name = `__Secure-better-auth.session_token`
                 value = signCookieValue(token, BETTER_AUTH_SECRET)
                 attrs = matches better-auth-server.ts session config
  → Set-Cookie header in response
  → client redirects to /setup-wizard
  → browser sends cookie
  → layout.tsx getSession() → reads same cookie → user loaded ✅
```

## Related Code Files

**Modify:**
- `apps/sophia-ai-factory/src/lib/better-auth-server.ts` — add explicit `advanced.cookiePrefix: '__Secure-'` (when HTTPS) + explicit `crossSubDomainCookies` config if needed
- `apps/sophia-ai-factory/src/app/api/welcome/validate/[token]/route.ts` — preferably switch from manual mint → call `auth.api.signInMagicLink()` or equivalent Better Auth official API
- `apps/sophia-ai-factory/src/lib/auth/sign-cookie-value.ts` — verify HMAC scheme matches Better Auth's `better-call/crypto.mjs`

**Verify (no edit):**
- `apps/sophia-ai-factory/wrangler.jsonc` — confirm Cloudflare secrets list

**New (potentially):**
- `apps/sophia-ai-factory/src/lib/better-auth-session.test.ts` — unit test for getSession/getCurrentUser helpers (Phase 04 will write)

## Implementation Steps

1. **Read Phase 01 logs** — `wrangler tail` for 5-10 min after triggering magic-link → confirm hypothesis (H1 vs H2 vs H3).
2. **Verify Wrangler secrets:**
   ```bash
   cd apps/sophia-ai-factory
   npx wrangler secret list
   ```
   Confirm: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` present. If missing:
   ```bash
   npx wrangler secret put BETTER_AUTH_URL  # value: https://sophia.agencyos.network
   ```
3. **Set explicit cookiePrefix in `better-auth-server.ts`:**
   ```ts
   betterAuth({
     ...,
     advanced: {
       useSecureCookies: true,           // forces __Secure- prefix
       defaultCookieAttributes: { sameSite: 'lax', secure: true, httpOnly: true, path: '/' },
     },
     session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
   })
   ```
4. **Switch manual mint → official Better Auth API** in `/api/welcome/validate/[token]/route.ts`:
   - Prefer: `auth.api.signInWithToken({ token, body: { ... } })` if available
   - Or: use Better Auth's internal session creator → returns proper Set-Cookie
   - Fallback: keep manual mint BUT use `auth.$context.internalAdapter.createSession()` to get token, then `setCookie` with EXACT attrs from Better Auth config
5. **Verify HMAC signing scheme** matches Better Auth's `better-call/crypto.mjs`:
   - Format: `value + '.' + base64url(HMAC-SHA256(value, secret))`
   - Encoding: `encodeURIComponent` on final string
6. **Local test with `wrangler dev --remote`:**
   - Trigger magic-link consumption
   - DevTools → confirm `Set-Cookie: __Secure-better-auth.session_token=...; Path=/; HttpOnly; Secure; SameSite=Lax`
   - Visit /setup-wizard with cookie → should NOT 307
7. **Run build + lint:**
   ```bash
   cd apps/sophia-ai-factory
   npm run build
   npm run lint
   grep -r ": any" src --include="*.ts" --include="*.tsx" | wc -l  # = 0
   ```

## Todo List

- [ ] Read Phase 01 wrangler tail logs (deferred — needs prod deploy)
- [ ] `wrangler secret list` confirms BETTER_AUTH_SECRET + BETTER_AUTH_URL (deferred)
- [x] Add `useSecureCookies: process.env.NODE_ENV !== 'development'` + `path: '/'` in better-auth-server.ts
- [x] Align `/api/welcome/validate/[token]` cookie name + Secure flag to match `useSecureCookies` env check (instead of BETTER_AUTH_URL-based HTTPS detection)
- [x] HMAC scheme unchanged — sign-cookie-value.ts already matches better-call/crypto pattern
- [ ] `wrangler dev --remote` local test (deferred — user handles browser test)
- [ ] DevTools shows correct Set-Cookie header (deferred)
- [x] Build + lint pass, 0 :any
- [ ] Commit on feature branch (deferred — user handles)

## Success Criteria

- Magic-link → /setup-wizard loads page (no 307) in `wrangler dev --remote`
- `Set-Cookie` header attributes match Better Auth config exactly
- `auth.api.getSession()` returns valid session after magic-link consumption
- Build 0 errors, 0 :any types

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Switching to Better Auth official API requires schema changes | Med | High | Read Better Auth docs first; if migration needed, defer to follow-up |
| HMAC scheme tweak breaks existing sessions | Low | High | Backwards-compat: support both old + new for 24h; force re-login after that |
| Cloudflare secret rotation invalidates ALL existing sessions | Low | High | Don't rotate BETTER_AUTH_SECRET unless absolutely needed |
| `useSecureCookies: true` breaks local dev (http://localhost) | Med | Med | Conditional: `useSecureCookies: process.env.NODE_ENV === 'production'` |

## Security Considerations

- BETTER_AUTH_SECRET must be ≥32 bytes random — never commit
- Cookie MUST be `HttpOnly` (prevent JS access) + `Secure` (HTTPS only) + `SameSite=Lax`
- HMAC signing prevents cookie tampering
- Magic-link token must be single-use + short-lived (≤ 15 min)
- `validate/[token]/route.ts` should rate-limit by token to prevent brute force

## Next Steps

- Phase 03 (i18n) can run in parallel with Phase 02 — independent files
- Phase 04 tests Phase 02 changes before push
- DO NOT push to main until Phase 04 unit + integration tests pass
