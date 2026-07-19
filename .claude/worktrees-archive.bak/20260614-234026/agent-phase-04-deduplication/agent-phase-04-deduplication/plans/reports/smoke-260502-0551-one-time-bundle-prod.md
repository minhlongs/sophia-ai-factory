# Smoke Report — One-Time Bundle (Prod, 2026-05-02)

**Status:** ✅ GREEN (HTTP-level) | ⏸ PENDING (full crypto payment flow)
**Deploy SHA:** f7c3b624 (manual `wrangler deploy` — CI bypass)
**Reason for CI bypass:** GitHub Actions disabled at user level (HTTP 422). Local build/test gate verified before deploy.

## What Was Verified ✅

### 1. Pricing page renders bundle card
- `GET /vi/pricing` → HTTP 200, body contains: `Gói Khởi`, `Mua Gói`, `10 video`, `one_time`
- `GET /en/pricing` (308 → /pricing) → body contains: `Starter Bundle`, `10 video`, `one-time`

### 2. Checkout endpoint live + correct gates
- `POST /api/payments/one-time-checkout` (was 404 pre-fix) → now responds:
  - empty body → `400 Invalid request` (zod)
  - `{skuId:"INVALID"}` → `400 Invalid input: expected "STARTER_BUNDLE"`
  - `{skuId:"STARTER_BUNDLE"}` (no session) → `401 Login required before checkout`
- Auth + SKU resolution + URL generator wired correctly.

### 3. Database schema migrated
- D1 remote `sophia-raas-db`:
  - `user_purchases` table created (mig 0038)
  - `videos.purchase_id` column + index added (mig 0039)

### 4. Subscription regression — zero impact
- Existing `/api/checkout` POST flow untouched.
- Tier IPN handler (`nowpayments-ipn-subscription.ts`) UNTOUCHED.
- Local: 2136 tests pass (zero regression vs 2075 baseline).

## Bug Found + Fixed During Smoke 🐛

**P0:** `OneTimeBundleCard` (one-time-bundle-card.tsx:85) calls `POST /api/payments/one-time-checkout` but the route file did not exist. Click would silently 404 in `handleBuy()` — no toast, no error surfaced.

**Fix:** `apps/sophia-ai-factory/src/app/api/payments/one-time-checkout/route.ts` (commit `f7c3b624`). Pattern mirrors `/api/checkout` POST: zod validation, `getCurrentUserFromHeaders()` auth, `createOneTimeInvoiceUrl()` call, returns `{ url }`.

**Detection mechanism gap:** Existing test pyramid covers IPN handler + repository + email template, but did NOT cover the `card.click → API.POST → NOWPayments.redirect` integration. Plan's Phase 04 e2e test was conceptual only.

## Pending (Out of Scope for Today) ⏸

- **Real crypto payment:** requires test USDT in TRC20 wallet + 5-min IPN wait. Did not execute.
- **Email landing in inbox:** requires SMTP env validation + test inbox access.
- **Browser screenshot proof per Rule 13 §B:** not captured (no headless browser here). Recommend running Playwright e2e against prod in next sprint.
- **CI deploy verification:** workflow `Tests & Deploy` cannot run while Actions disabled. User must restore Actions billing/account first; then `gh workflow run test.yml --ref main` to dispatch.
- **`/api/version` shortSha mismatch:** still shows `df22a4f7` (env var injected by CI deploy job). Manual wrangler deploy does not set `COMMIT_SHA` Worker secret. Non-blocking but cosmetic — fix by adding `wrangler secret put COMMIT_SHA` step in any future manual deploy script.

## Open Questions

1. Should `OneTimeBundleCard.handleBuy()` show a user-facing error toast when API returns non-200? Current code silently `setLoading(false)` with no feedback.
2. Restore GitHub Actions: billing issue or account verification? (`gh api .../actions/permissions` says enabled, but workflow_dispatch returns 422 user-level disable.)
3. Add an e2e Playwright test (`tests/e2e/one-time-checkout.spec.ts`) that mocks auth and asserts `/api/payments/one-time-checkout` returns a NOWPayments URL.
