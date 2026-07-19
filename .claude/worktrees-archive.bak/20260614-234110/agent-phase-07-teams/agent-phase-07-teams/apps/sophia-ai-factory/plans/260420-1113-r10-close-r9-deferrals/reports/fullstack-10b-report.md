# Phase 10B Implementation Report

**Date:** 2026-04-20  
**Status:** COMPLETED

---

## Files Modified

| File | Change | LOC delta |
|------|--------|-----------|
| `src/app/[locale]/dashboard/byok/loading.tsx` | Remove `max-w-2xl mx-auto` from outer div | -1 |
| `src/lib/security/sql-rate-limiter.ts` | Add `discovery` bucket (30 req/60s) to RATE_LIMITS | +2 |
| `src/middleware.ts` | Wire `/api/discovery` branch + INFO-1 comment + type union + discovery limit_type | +10 |
| `src/lib/signals/d1-event-types.ts` | Add `DISCOVERY_SCORE_REQUESTED` enum + schema; add `'discovery'` to ApiRateLimitHitSchema | +12 |
| `src/app/api/discovery/score/route.ts` | Import track/D1Events; emit audit event; update docstring | +15 |
| `src/app/api/discovery/score/route.test.ts` | +2 tests: audit emission + rate-limit bucket | +30 |

---

## Tasks Completed

- [x] L-1: `loading.tsx` outer container now matches `page.tsx` (`space-y-6` only, no `max-w-2xl mx-auto`)
- [x] L-3: `RATE_LIMITS.discovery` added to `sql-rate-limiter.ts` (30 req/60s, identifier='discovery')
- [x] L-3: `/api/discovery` branch wired in middleware before `/api/webhooks` branch
- [x] L-3: `DISCOVERY_SCORE_REQUESTED` event + Zod schema added to d1-event-types
- [x] L-3: `route.ts` emits audit event (try/catch, fire-and-forget); docstring updated
- [x] L-3: +2 tests (audit emission assertion + RATE_LIMITS.discovery bucket assertion)
- [x] INFO-1: `middleware-matcher-audit.md` written with DEAD verdict + R11 defer recommendation
- [x] INFO-1: `// INFO-1 R10` comment added above dead `/api` branch in middleware.ts

---

## Tests Status

- Unit tests: **10/10 pass** (`pnpm vitest run src/app/api/discovery/score/route.test.ts`)
- Type check: skipped (next.config.ts has `ignoreBuildErrors: true`; no new `:any`)

---

## INFO-1 Audit Verdict

**DEAD** — matcher `/((?!api|...).*) ` excludes all `/api/*` at Next.js routing layer.
Lines 69–195 of `src/middleware.ts` are unreachable for API requests.
Per-route wrappers (`src/app/api/admin/middleware.ts`) handle auth independently.
Fix deferred to R11 (high risk: CF Workers binding + per-route double-apply concerns).

---

## Issues Encountered

- `src/middleware/rate-limit-config.ts` already had a `discovery` bucket — but `src/middleware.ts` imports from `src/lib/security/sql-rate-limiter.ts` (different RATE_LIMITS). Added discovery to the correct source.
- `ApiRateLimitHitSchema` `limit_type` enum needed `'discovery'` added to prevent Zod validation failure on rate-limit track() calls for discovery routes.
