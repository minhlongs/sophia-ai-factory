# Browser Smoke Test Playbook — One-Time RaaS Bundle

**Date:** 2026-05-02
**Scope:** One-Time STARTER_BUNDLE purchase flow end-to-end verification
**Rule Reference:** Rule 13 (Browser Discipline) + sophia-deploy-verify.md

---

## Prerequisites

- [ ] Production deployed + CI/CD GREEN (see sophia-deploy-verify.md)
- [ ] Deploy SHA matches local commit (via `/api/version` endpoint)
- [ ] HTTP 200 on https://sophia.agencyos.network
- [ ] Fresh browser session (clear cookies, cache)
- [ ] Screenshots directory prepared: `plans/260502-0508-raas-one-time-zero-bug/reports/screenshots/`

---

## Test Scenario 1: Pricing Page Visibility

**Goal:** Verify ONE-TIME Bundle card appears on pricing page (Vi + En locales)

### Steps

1. **Navigate to pricing page (Vietnamese)**
   - URL: `https://sophia.agencyos.network/vi/pricing`
   - Expected: Pricing page loads with 4 cards visible (BASIC/PREMIUM/ENTERPRISE/MASTER tiers + STARTER_BUNDLE card)
   - [ ] Screenshot: `01-pricing-vi-bundle-visible.png`
     - Capture: Full page showing STARTER_BUNDLE card with "$49 / 10 credits / 12 months" text
     - Verify label: "Gói Khởi Đầu — 10 video / 12 tháng" (Vietnamese)

2. **Navigate to pricing page (English)**
   - URL: `https://sophia.agencyos.network/en/pricing`
   - Expected: Same layout, English labels
   - [ ] Screenshot: `02-pricing-en-bundle-visible.png`
     - Capture: Full page showing STARTER_BUNDLE card with English label
     - Verify label: "Starter Bundle — 10 videos / 12 months"

3. **Verify bundle card styling**
   - [ ] One-time bundle card has visually distinct styling (different border/color) from subscription tiers
   - [ ] "Buy Bundle" button text is clear and clickable
   - [ ] Price and credit info clearly displayed

---

## Test Scenario 2: NOWPayments Checkout Redirect

**Goal:** Click bundle card, verify redirect to NOWPayments hosted checkout works

### Steps

1. **Click "Buy Bundle" button**
   - Page: `https://sophia.agencyos.network/pricing` (any locale)
   - Action: Click "Buy Bundle" CTA on STARTER_BUNDLE card
   - Expected: Redirect to NOWPayments checkout URL with structure:
     ```
     https://nowpayments.io/payment?iid=7810429001&order_id=sophia_<userid>_<timestamp>&success_url=...&cancel_url=...
     ```
   - [ ] Screenshot: `03-nowpayments-checkout-url.png`
     - Capture: Browser address bar showing NOWPayments domain
     - Verify URL contains: `iid=7810429001`, `sophia_` prefix in order_id

2. **Verify NOWPayments page loads**
   - Expected: NOWPayments hosted invoice page loads (HTTP 200)
   - [ ] Page shows invoice details:
     - Amount: $49 USD
     - USDT payment method option visible
     - Payment countdown timer (if applicable)
   - [ ] Screenshot: `04-nowpayments-invoice-loaded.png`
     - Capture: NOWPayments invoice page showing price and payment method

3. **Verify cancel flow**
   - Action: Click "Cancel" or close NOWPayments without paying
   - Expected: Redirect back to `https://sophia.agencyos.network/pricing`
   - [ ] Screenshot: `05-nowpayments-cancel-redirects-to-pricing.png`

---

## Test Scenario 3: Backend Smoke Delivery (Admin-Only)

**Goal:** Simulate one-time purchase completion and verify dashboard updates

### Prerequisites

- [ ] Admin account with access token
- [ ] Smoke endpoint enabled: `/api/cron/smoke-one-time-deliver` (gated by `SMOKE_BYPASS_TOKEN`)
- [ ] Token stored in test env: `SMOKE_BYPASS_TOKEN=<production-token>`

### Steps

1. **Trigger smoke fulfillment**
   - Command:
     ```bash
     curl -X POST https://sophia.agencyos.network/api/cron/smoke-one-time-deliver \
       -H "Authorization: Bearer $SMOKE_BYPASS_TOKEN" \
       -H "Content-Type: application/json" \
       -d '{
         "user_id": "smoke_test_user_<timestamp>",
         "sku": "STARTER_BUNDLE",
         "payment_id": "pay_smoke_<timestamp>"
       }'
     ```
   - Expected: HTTP 200 response with purchase_id
   - [ ] Record response JSON for verification

2. **Poll dashboard for video**
   - URL: `https://sophia.agencyos.network/dashboard/videos`
   - Login: Admin/test account
   - Expected: New video card appears within 5 minutes
   - [ ] Screenshot: `06-dashboard-one-time-video-present.png`
     - Capture: /dashboard/videos showing new video tile
     - Verify: Purchase linkage label present (e.g., "Via STARTER_BUNDLE")

3. **Verify video metadata**
   - Click on new video card
   - Expected: Video detail page loads with:
     - Video status: "Completed" or "Ready to view"
     - Purchase linkage: STARTER_BUNDLE reference
     - Generated timestamp: recent (within last 5 minutes)
   - [ ] Screenshot: `07-dashboard-video-detail.png`

---

## Test Scenario 4: Email Delivery Verification (Optional)

**Goal:** Verify bilingual email sent after video ready

### Prerequisites

- [ ] Test email account accessible: `support+test@sophia.agencyos.network` (or forwarded to personal email)
- [ ] Email logs endpoint available (if accessible)

### Steps

1. **Check email inbox**
   - After smoke delivery completes, wait 2-3 minutes
   - Expected: Email arrives with subject:
     - Vietnamese: "[Sophia AI] Video của bạn đã sẵn sàng!"
     - English: "[Sophia AI] Your bundle video is ready!"
   - [ ] Screenshot: `08-email-received.png`

2. **Verify email content**
   - Open email
   - Expected: Body contains:
     - Bilingual headers (if mixed locale setup)
     - "Credits remaining: 9" (1 used for video)
     - "Dashboard" link (clickable)
     - "See monthly plans" cross-sell CTA
     - Support email footer
   - [ ] Screenshot: `09-email-content.png`

3. **Click email CTA**
   - Action: Click "Dashboard" or "See monthly plans" link
   - Expected: Browser navigates to correct URL
   - [ ] Screenshot: `10-email-cta-redirect.png`

---

## Test Scenario 5: Subscription Regression (Critical)

**Goal:** Verify existing subscription tiers still work (zero regression)

### Steps

1. **Navigate to pricing (Vi)**
   - URL: `https://sophia.agencyos.network/vi/pricing`
   - Expected: All 4 subscription tier cards visible:
     - BASIC ($1.99/mo)
     - PREMIUM ($3.99/mo)
     - ENTERPRISE ($7.99/mo)
     - MASTER ($49.99/mo)
   - [ ] Screenshot: `11-subscription-tiers-intact.png`

2. **Click tier payment button**
   - Action: Click "Buy Now" on PREMIUM tier
   - Expected: NOWPayments checkout loads for PREMIUM tier
   - [ ] Verify invoice_id is subscription tier invoice (not one-time)
   - [ ] Screenshot: `12-subscription-checkout-loads.png`

3. **Verify IPN handler receives correct tier**
   - (Internal verification after manual payment)
   - Check logs for: `[IPNDispatch] Routing to subscription handler`
   - Expected: User tier upgraded to PREMIUM in database
   - [ ] Confirm via `/api/health` or admin panel

---

## Test Scenario 6: Edge Cases

### One-Time Purchase Replay (Idempotency)

1. **Simulate replay of same payment_id**
   - Curl:
     ```bash
     curl -X POST https://sophia.agencyos.network/api/webhooks/nowpayments \
       -H "X-NOWPAYMENTS-SIG: <signature>" \
       -H "Content-Type: application/json" \
       -d '{
         "payment_id": "pay_dup_<same-id>",
         "payment_status": "finished",
         "invoice_id": "7810429001",
         "order_id": "sophia_user1_123456",
         "price_amount": 49
       }'
     ```
   - Expected:
     - First call: Purchase created, fulfillment triggered
     - Second call (same payment_id): No duplicate row, no duplicate email, no error
   - [ ] Database check: Only 1 row in user_purchases for this payment_id

### Refund Flow

1. **Test refund IPN**
   - Curl:
     ```bash
     curl -X POST https://sophia.agencyos.network/api/webhooks/nowpayments \
       -H "X-NOWPAYMENTS-SIG: <signature>" \
       -d '{
         "payment_id": "pay_test_refund",
         "payment_status": "refunded",
         "invoice_id": "7810429001",
         "order_id": "sophia_user2_234567"
       }'
     ```
   - Expected:
     - user_purchases row marked status='refunded'
     - credits_remaining set to 0
     - Video access NOT revoked (CEO decision)
   - [ ] Database verification: status='refunded', credits=0

---

## Rollback Checklist (if issues detected)

- [ ] Review deployment logs: `gh run view <run_id> --log`
- [ ] Check error logs: `curl https://sophia.agencyos.network/api/logs` (if available)
- [ ] Revert deploy: `npx wrangler rollback --name sophia-ai-factory --message "One-time bundle smoke fail"`
- [ ] Notify team: Slack #sophia-ai-factory with rollback reason
- [ ] Create incident ticket: Add to Linear SOPHIA project

---

## Sign-Off

- [ ] All 7 test scenarios completed successfully
- [ ] No regressions in subscription tiers
- [ ] Screenshots captured and organized
- [ ] Zero critical errors in logs

**Final Status:** [ ] GREEN (Ready to announce) | [ ] YELLOW (Minor issues, acceptable) | [ ] RED (Critical failure, rollback)

**Tested By:** _____________________
**Date:** _____________________
**Notes:** _______________________________________________________________________________

