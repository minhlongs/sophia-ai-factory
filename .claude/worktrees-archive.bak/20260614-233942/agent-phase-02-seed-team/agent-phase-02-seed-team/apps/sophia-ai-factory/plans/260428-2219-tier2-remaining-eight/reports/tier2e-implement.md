# TIER-2E: CSP Nonce Injection — Implementation Report

**Status:** COMPLETE  
**Date:** 2026-04-28

## Files Modified

| File | Change |
|------|--------|
| `src/lib/security/content-security-policy-configuration.ts` | Removed `'unsafe-inline'` from base scriptSrc; `buildCSPHeader(nonce?)` inserts `'nonce-{nonce}'` when provided, falls back to `'unsafe-inline'` when absent |
| `src/middleware.ts` | Generates nonce via `crypto.getRandomValues` (Edge-safe); injects `Content-Security-Policy` + `x-csp-nonce` headers on all HTML responses; propagates nonce to Server Components via `NextResponse.next({ request: { headers } })` |
| `next.config.ts` | Removed `buildCSPHeader` import + static CSP header — middleware is sole owner |
| `src/app/[locale]/layout.tsx` | Calls `getCspNonce()` and passes `nonce` prop to JSON-LD `<script>` tag |

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/security/get-csp-nonce.ts` | Server Component helper reads `x-csp-nonce` from `headers()` |
| `src/lib/security/content-security-policy-configuration.test.ts` | 13 tests: nonce injection, fallback, all directives, directive format |

## Test Results

- `npm test -- content-security-policy-configuration` → 13/13 pass
- `npm test` (full suite) → 1673 passed, 31 skipped, 0 failures (up from ~1660 baseline)
- `npm run build` → 0 errors

## Design Decisions

1. **Single owner (middleware):** next.config.ts static headers removed → no dual-header conflict.
2. **Fallback:** When no nonce (static gen contexts), `'unsafe-inline'` is preserved so any cached/CDN responses don't break pages.
3. **style-src unchanged:** `'unsafe-inline'` kept for Tailwind dynamic class injection.
4. **Edge-safe:** `crypto.getRandomValues(new Uint8Array(16))` → hex string. No `node:crypto`.
5. **Dashboard code path:** `NextResponse.next({ request: { headers: requestHeaders } })` used to propagate nonce into Server Component `headers()` context; intl/cors headers merged manually.

## Pages/Inline Scripts at Risk

| Location | Inline script? | Mitigated? |
|----------|---------------|------------|
| `src/app/[locale]/layout.tsx` | JSON-LD `<script dangerouslySetInnerHTML>` | YES — `nonce={nonce}` added |
| Next.js hydration chunks | Injected by Next.js runtime | YES — Next.js 16 auto-attaches nonce to runtime scripts from `nonce` CSP header |
| PostHog (`PostHogProvider`) | Loads via `next/script` | REVIEW — may need `nonce` prop if PostHog injects inline scripts |
| Sentry (`ErrorReporter`) | No inline scripts in current impl | OK |
| PWA service worker | Served as static `.js` file, not inline | OK |
| Setup Wizard | No inline scripts | OK |
| Admin layout | Uses intl middleware path with CSP | OK |

## Unresolved Questions

1. **PostHog:** `PostHogProvider` calls `posthog.init()` which may inject an inline `<script>`. If PostHog uses inline scripts (depends on version), it will be blocked post-nonce. Verify in browser dev tools on first deploy.
2. **Sentry breadcrumb scripts:** Sentry SDK v8 should not inject inline scripts when using `<ErrorBoundary>` component pattern used here, but confirm with browser CSP console on staging.
3. **Dashboard `intlMiddleware` merge:** The nonce propagation for `/dashboard` routes relies on header-merging between `NextResponse.next()` and `intlMiddleware(request)`. If next-intl adds response headers that conflict, may need adjustment.
