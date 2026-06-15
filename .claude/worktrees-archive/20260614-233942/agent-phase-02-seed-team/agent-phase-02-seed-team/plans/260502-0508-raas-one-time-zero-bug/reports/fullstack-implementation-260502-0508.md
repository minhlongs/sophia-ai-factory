# Phase Implementation Report — RaaS One-Time Zero Bug

**Date:** 2026-05-02 | **Phases:** 01, 02, 03 | **Status:** completed

## Files Modified / Created

### Phase 01 — Schema + Pricing
- **CREATED** `migrations/0038-user-purchases-one-time.sql` — user_purchases table + 3 indexes
- **CREATED** `src/config/one-time-skus.ts` — STARTER_BUNDLE SKU catalog + Zod validation
- **CREATED** `src/lib/db/repositories/user-purchases-repo.ts` — insertPurchase, getByPaymentId, listByUser, getUserCredits, markPaid, markRefunded, decrementCredits
- **CREATED** `src/lib/db/get-user-credits.ts` — re-export barrel
- **CREATED** `src/components/pricing/one-time-bundle-card.tsx` — bilingual pricing card
- **MODIFIED** `src/types/index.ts` — PurchaseKind, OneTimeSkuId, PurchaseStatus, UserPurchase, OneTimeSku types added
- **MODIFIED** `src/lib/clients/nowpayments-client.ts` — lookupInvoice() discriminated union, createOneTimeInvoiceUrl()
- **MODIFIED** `src/app/[locale]/pricing/page.tsx` — added OneTimeBundleCard below PricingSection

### Phase 02 — IPN Dispatcher
- **CREATED** `src/lib/billing/nowpayments-ipn-one-time.ts` — handleOneTimeFinished, handleOneTimeRefunded
- **CREATED** `src/lib/billing/nowpayments-ipn-dispatch.ts` — dispatchFinished, dispatchRefunded
- **CREATED** `src/lib/fulfillment/one-time-fulfillment.ts` — stub (replaced in Phase 03)
- **MODIFIED** `src/lib/billing/nowpayments-ipn-handlers.ts` — handleFinished/handleRefunded replaced with dispatchers

### Phase 03 — Video Trigger + Delivery
- **CREATED** `migrations/0039-videos-purchase-id.sql` — ALTER TABLE videos ADD COLUMN purchase_id
- **CREATED** `src/lib/video/one-time-welcome-script.ts` — bilingual welcome scripts per SKU
- **CREATED** `src/lib/billing/email/templates/one-time-bundle-ready.ts` — Vi/En HTML+text email template
- **CREATED** `src/lib/billing/email/send-one-time-bundle-ready-email.ts` — idempotent Resend send + billing_events log
- **MODIFIED** `src/lib/fulfillment/one-time-fulfillment.ts` — full implementation (HeyGen + videos insert)
- **MODIFIED** `src/app/api/cron/video-status-sync/route.ts` — branch on purchase_id to send one-time email on completion

## Build Status
- Phase 01: PASS (0 TS errors)
- Phase 02: PASS (0 TS errors)
- Phase 03: PASS (0 TS errors)

## Test Status
- Baseline: 1798 tests (per task description)
- Actual observed: 2075 tests pass / 31 skipped (diff from pre-existing count includes prior work)
- Zero new failures across all phases
- Existing IPN subscription tests: verified passing (no regression)

## Key Design Decisions
- Idempotency: insertPurchase checks getByPaymentId first (DB check before INSERT)
- Refund: marks credits_remaining=0, video access kept (CEO decision)
- Email: idempotent via billing_events.email_template = 'one_time_bundle_ready' per purchaseId
- Cron branch: `purchase_id IS NOT NULL` → one-time email path; `IS NULL` → existing onboarding path unchanged
- Migrations: 0038 applied locally; 0039 applied after running 0024-videos.sql prerequisite

## Ready for Phase 04
YES — all acceptance criteria met:
- Build 0 errors
- Tests 2075 pass (0 regression on subscription path)
- Zero :any, zero console.log in production code
- Tier enum BASIC|PREMIUM|ENTERPRISE|MASTER untouched
- nowpayments-ipn-subscription.ts UNCHANGED
- ONBOARDING_TIERS flow unchanged
