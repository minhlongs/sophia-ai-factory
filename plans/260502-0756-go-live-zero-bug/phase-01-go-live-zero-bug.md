# Phase 01 — Go-Live Zero-Bug Hardening

**Status:** COMPLETE  
**Date:** 2026-05-02

## Features Implemented

### A — verifyCronAuth hardening (P0 Security) ✅

**Problem:** `x-cf-cron: true` header from any external caller bypassed auth → DoS/cost-bomb risk.

**Files changed:**
- `src/lib/security/cron-auth.ts` — removed x-cf-cron bypass; dev-mode bypass moved to top; x-cron-secret legacy path now requires exact secret (no `'true'` shortcut)
- `src/lib/security/__tests__/cron-auth.test.ts` — added P0 rejection tests; updated legacy header tests; 17 total assertions
- `scripts/inject-scheduled-handler.mjs` — dispatch header changed from `x-cf-cron: 'true'` to `Authorization: Bearer <CRON_SECRET>`; added guard if `CRON_SECRET` unset (logs error + skips dispatch)
- `scripts/set-cron-secret.sh` (NEW) — operator setup script; generates 32-byte random secret via `openssl rand -hex 32`; sets via `wrangler secret put`

**Migration required:** Operator MUST run `bash apps/sophia-ai-factory/scripts/set-cron-secret.sh` BEFORE next deploy.

### C — HeyGen health check + pricing gate (P0 UX) ✅

**Files changed:**
- `src/app/api/health/heygen/route.ts` (NEW) — GET endpoint; pings HeyGen `/v1/user.get` with 5s timeout; caches in EXPERIMENT_KV for 60s; rate-limited (60 req/min); never 500s
- `src/lib/health/heygen-health-check.ts` (NEW) — server-side helper for direct KV-cached health check (avoids HTTP roundtrip in RSC)
- `src/app/[locale]/pricing/page.tsx` — calls `isHeyGenHealthy()` server-side; passes `heygenHealthy` prop to `OneTimeBundleCard`; wrapped in `Promise.all` with translations
- `src/app/api/health/heygen/route.test.ts` (NEW) — 8 tests covering: missing key, 200, 401, 500, 429, network error, timeout, shape validation

### D — Error toast on checkout failure (P1 UX) ✅

**Files changed:**
- `src/components/pricing/one-time-bundle-card.tsx` — added `heygenHealthy` prop + disabled CTA; added `error` useState; `handleBuy` now reads `!res.ok` → calls `errorMessageFor(status, body, lang)` helper; renders error `<p role="alert">` below CTA; 401 shows Login link
- `src/components/pricing/one-time-bundle-card.test.tsx` (NEW) — 11 tests covering: health gate, 401/400/429/500/503 error messages, network error, retry clear, success redirect

### G — Failed_permanent state in order-card (P2 UI) ✅

**Files changed:**
- `src/app/[locale]/dashboard/orders/order-card.tsx` — added red failure notice block (❌ icon + bilingual title/subtitle); retry notice hidden when `failed_permanent`; `mailto` subject now uses `purchaseId` (prop) not `order.purchaseId` for correct value
- `src/app/[locale]/dashboard/orders/order-card.test.tsx` (NEW) — 13 tests covering: En/Vi title+subtitle, icon presence, mailto href, no Watch button, no retry notice, access revoked state

## Test Results

- Total: 2240 passed (was 2205) — +35 new tests
- Build: ✓ compiled clean 0 TS errors
- All new test files: 4 created

## Follow-up Tasks for Main Session

1. **CRITICAL:** Run `bash apps/sophia-ai-factory/scripts/set-cron-secret.sh` BEFORE next deploy
2. After setting CRON_SECRET secret: trigger deploy via `git push origin main`
3. Post-deploy: verify all cron routes return non-401 by checking Cloudflare Workers logs for `[scheduled]` lines
4. Probe `/api/health/heygen` in production to confirm KV caching works (second request within 60s should return same `checkedAt`)
