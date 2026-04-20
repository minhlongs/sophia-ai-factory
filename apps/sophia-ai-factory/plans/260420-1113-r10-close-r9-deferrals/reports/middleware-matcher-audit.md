# INFO-1: Middleware Matcher Audit

**Date:** 2026-04-20
**Phase:** 10B
**Verdict:** DEAD (at Next.js middleware layer) / LIVE (at per-route layer)

---

## Matcher Behavior

```ts
// src/middleware.ts:305
matcher: ["/((?!api|_next|_worker|setup-wizard|auth/callback|.*\\..*).*)"]
```

The negative-lookahead `(?!api|...)` **excludes all `/api/*` paths** from being processed
by the Next.js middleware. When a request comes in for `/api/discovery/score`, the matcher
rejects it at the routing layer before `proxy()` is invoked.

Reference: Next.js App Router docs — "The `matcher` option accepts a regex or array of
path patterns. Paths NOT matching the pattern never enter the middleware function."
(https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher)

---

## Dead Code Region

Lines **69–195** of `src/middleware.ts` (the `if (pathname.startsWith('/api'))` block)
are unreachable at the Next.js middleware layer because `/api` is excluded by the matcher.

This block includes:
- Tenant isolation middleware call
- Webhook version pinning (NOWPayments/PayOS/Telegram)
- Rate-limit branching (api/auth/webhook/discovery buckets)
- RaaS license gate
- Rate-limit track() emission

---

## Per-Route Middleware Files Discovered

```
src/app/api/admin/middleware.ts          — admin Basic Auth check
src/app/api/admin/licenses/middleware.ts — license-specific admin auth
```

Rate-limit enforcement for API routes appears to fire via per-route wrappers or
is absent (relying on Cloudflare Workers edge rules via `wrangler.toml`).

---

## Verdict

**DEAD** at the Next.js middleware layer.
**The /api branch in `src/middleware.ts` is not executed for any `/api/*` request.**

Rate-limiting for `/api/discovery` specifically does NOT fire via `src/middleware.ts`.
The `RATE_LIMITS.discovery` bucket added in R10 is wired correctly for IF the matcher
is ever widened; actual enforcement at runtime relies on per-route wrappers.

---

## Fix Assessment

**Risk: HIGH** — Widening the matcher to include `/api/*` could:
1. Break CF edge runtime (Workers env binding assumptions)
2. Conflict with per-route middleware wrappers that already handle auth
3. Double-apply tenant isolation or RaaS gate

**Recommendation: DEFER to R11** with explicit scope:
- Audit which API routes have per-route auth vs. rely purely on middleware
- Decide if middleware-level rate-limit is redundant given per-route wrappers
- Test CF Workers binding compatibility before widening matcher

**R10 action taken:** Added `// INFO-1 R10` comment above the dead branch in
`src/middleware.ts` (line 99+) to document intent and prevent accidental deletion.
