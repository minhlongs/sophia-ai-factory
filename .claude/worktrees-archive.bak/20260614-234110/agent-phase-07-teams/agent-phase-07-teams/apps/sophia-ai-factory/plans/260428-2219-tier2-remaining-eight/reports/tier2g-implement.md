# TIER-2G — CSRF Protection Implementation Report

**Date:** 2026-04-28
**Status:** COMPLETE

## Files Created / Modified

| File | LOC | Action |
|------|-----|--------|
| `src/lib/security/csrf.ts` | 100 | Created — core CSRF utilities |
| `src/lib/security/use-csrf-token.ts` | 29 | Created — React hook for client |
| `src/lib/security/csrf.test.ts` | 130 | Created — 21 tests |
| `src/middleware.ts` | +14 lines | Modified — wire CSRF check + seed |

## Implementation Summary

**Pattern:** Double-submit cookie. Token stored in `csrf-token` cookie (SameSite=Strict, httpOnly=false), echoed by client in `x-csrf-token` header on mutations. Constant-time comparison via XOR loop prevents timing attacks.

**Token:** 32-byte `crypto.getRandomValues()` → 64-char lowercase hex. Edge runtime compatible.

**Bypass paths (no CSRF check):**
- GET / HEAD / OPTIONS — safe methods
- `/api/auth/*` — Better Auth own CSRF
- `/api/webhooks/*` — NOWPayments IPN, Telegram, PayOS (sig-auth)
- `/api/cron/*` — Cloudflare Workers internal triggers

**Cookie seeded:** On GET requests where `csrf-token` cookie is absent, the token is generated and set on the response before it exits middleware.

## Test Results

- `npm test -- csrf`: 21/21 pass
- `npm test` (full suite): 1643/1643 pass (0 regressions)
- `npm run build`: compiled successfully (0 TS errors)

## Callers Needing `x-csrf-token` Header (NOT fixed — future sweep PR)

These client-side fetch calls to mutating internal API routes will 403 once CSRF enforcement goes live. Each needs `...useCsrfToken()` spread into headers:

1. `src/components/license/license-alert-panel.tsx:40` — `POST /api/alerts/:id/read`
2. `src/components/license/license-alert-panel.tsx:51` — `POST /api/alerts/:id/dismiss`
3. `src/components/missions/mission-control-header.tsx:50` — `POST /api/agents/pause`
4. `src/components/admin/licenses/use-license-list-actions.ts:108` — `POST /api/admin/licenses/:id/reactivate`
5. `src/components/dashboard/referral-share-widget.tsx:20` — `POST /api/referral/generate`
6. `src/components/raas/api-key-list.tsx:86` — `DELETE /api/admin/api-keys/:id`
7. `src/components/setup-wizard/local-mode-step.tsx:92` — `DELETE /api/setup/local-mode/provision`

Server Actions (Next.js) bypass middleware entirely — no change needed there.
External outbound fetches (PostHog, BetterStack, webhook-notification-service, worker overage) are not in-app mutations — exempt.

## Notes

- `parseCookieHeader` fallback added to `verifyCsrfToken`: jsdom test env does not populate `NextRequest.cookies` from the raw `cookie` header; fallback parses it manually. Production edge runtime uses `req.cookies.get()` which works correctly.
- Setup Wizard: `/api/setup/*` routes require CSRF (no bypass). The `local-mode-step.tsx` DELETE call (item 7 above) must be patched in the follow-up sweep before enforcement is enabled.
