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

## Critical Fix Applied During Cook (Cron Handler Export)

**Timestamp:** 2026-05-02 ~14:50 UTC (mid-D feature)  
**Discovery:** scheduled() in `scripts/inject-scheduled-handler.mjs` was named export → Cloudflare Workers didn't recognize it as cron entry point → handler never fired even after CRON_SECRET deploy.  
**Root cause:** Line 1-2 had `export async function scheduled(...)` instead of wrapping as method on `export default { ... }`.  
**Fix:** Refactored to `const scheduled = async (...) => {...}; export default { scheduled }`.  
**Verification:** Deployed 15:26 UTC → cron_run_log shows fulfillment-retry count incremented 2→3 at 15:27 UTC (1 min post-deploy) → handler CONFIRMED firing in production.

## Deployment & Verification Complete

✓ 2026-05-02 15:26 UTC — 4 commits pushed to main  
✓ CI/CD: GitHub Actions GREEN  
✓ Build: 0 TS errors  
✓ Tests: 2240 pass  
✓ Production SHA matches 84ad25ea  
✓ Cron firing verified in live cron_run_log

## Deferred Tasks (Non-Blocking Manual)

1. **B:** Supabase migration push (user manual step)
2. **E:** HeyGen webhook registration (user manual step)
3. **F:** $49 tier smoke test with real money (user smoke test)
4. **H:** GitHub Actions restore (user ops)
5. **I:** Alert pipeline config (deferred to live smoke phase)
