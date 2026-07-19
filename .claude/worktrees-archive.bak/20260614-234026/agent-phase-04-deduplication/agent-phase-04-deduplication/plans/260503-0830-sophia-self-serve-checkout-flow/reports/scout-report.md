# Scout Report: Existing Checkout Infrastructure

Date: 2026-05-03
Project: sophia-ai-factory
Path: apps/sophia-ai-factory/

## What Already Exists (Reuse, Don't Rebuild)

### Tier Configuration (READY)
- `src/config/tiers/tier-configs.ts` — TIER_CONFIGS with NOWPayments invoice IDs already wired
- `src/config/tiers/unified-limits.ts` — UNIFIED_TIERS (BASIC $199, PREMIUM $399, ENTERPRISE $799, MASTER $4,999 lifetime)
- Tier enum confirmed uppercase: BASIC | PREMIUM | ENTERPRISE | MASTER

### NOWPayments Client (READY)
- `src/lib/clients/nowpayments-client.ts`
  - `NOWPAYMENTS_TIERS` — pre-created invoice IDs in dashboard
  - `createInvoiceUrl(tier, userId, customerEmail?)` — builds checkout URL with order_id pattern `sophia_${userId}_${timestamp}`
  - `verifyIpnSignature(rawBody, signature, secret)` — HMAC-SHA512 with timing-safe comparison ALREADY IMPLEMENTED
  - `getTierByInvoiceId()` and `lookupInvoice()` for IPN dispatch (handles subscription + one-time SKUs)

### Checkout API (PARTIAL — needs hardening)
- `src/app/api/checkout/route.ts`
  - GET handler: tier query → redirect to NOWPayments (used by Telegram bot URL buttons)
  - POST handler: { tier, customerEmail, promoCode } → returns { url }
  - Has rate limiting (10 req/min) and Better Auth session check
  - Has promo code reservation logic
  - **GAP**: No `pending_orders` table — no record of who started checkout
  - **GAP**: No yearly/monthly period selector
  - **GAP**: No PayOS branch

### IPN Webhook (READY but verify idempotency)
- `src/app/api/webhooks/nowpayments/route.ts` — verifies HMAC-SHA512, dispatches to handlers
- `src/lib/billing/nowpayments-ipn-db.ts`:
  - `isPaymentProcessed(paymentId)` — idempotency check via payment_events table
  - `recordIpnEvent(paymentId, status, payload, processed)` — upsert event
  - `parseUserIdFromOrderId(orderId)` — extracts userId from `sophia_${userId}_${timestamp}` pattern
- `src/lib/billing/nowpayments-ipn-subscription.ts` — handleFinished() does atomic subscription upsert; underpayment guard at 99%; audit log via recordAudit; auto-handover; onboarding video trigger
- Migration `0002-payment-events.sql` — payment_events table exists

### Pricing Page (READY but public-flow needs validation)
- `src/app/[locale]/pricing/page.tsx` — shows tier cards, comparison table, FAQ; pulls currentTier when user logged in
- `src/components/pricing/pricing-section.tsx` — handles tier select → POST /api/checkout → redirect
- `src/components/pricing/pricing-card.tsx` + `pricing-data.ts` exist
- **GAP**: No monthly/yearly toggle (only monthly today)
- **GAP**: When unauthenticated user clicks tier, gets 401 from POST `/api/checkout` — needs UX fix to redirect to login first
- `src/components/pricing/coupon-input.tsx` — promo code input working

### Payment Success Page (READY)
- `src/app/[locale]/payment-success/page.tsx` — bilingual, masked email, next steps, dashboard CTA. Reads searchParams (tier, sku, order_id, email, via, code, trial_days)
- **GAP**: No payment status check — page loads optimistically. Should poll /api/checkout/status?order_id=... or query payment_events to confirm activation before showing success

### Dashboard Tier Widget (READY)
- `src/components/dashboard/plan-upgrade-widget.tsx` — shows current tier, upgrade CTAs to NOWPayments invoice URLs
- **GAP**: Direct NOWPayments link without order_id — IPN handler can't link to user → loses upgrade tracking. Should POST to /api/checkout to get tracked URL

### Email System (READY)
- `src/lib/email/sender.ts`, `email-templates.ts`, `onboarding-emails.ts` (Resend)
- `src/lib/billing/resend-email-service.ts`
- Auto-handover already triggers post-payment email (magic link)
- **GAP**: No dedicated payment receipt email template (handover != receipt)

### Tests (READY pattern)
- `src/app/api/checkout/route.test.ts` — existing checkout tests
- `src/lib/billing/__tests__/` — IPN handler tests
- Vitest 844+ tests pass; Playwright E2E exists

### Database (READY)
- D1 binding `DB` via `createServerClient()` (sync, no await)
- Migration runner via wrangler
- Existing tables: payment_events, organizations, org_members, subscriptions, user_purchases, user (Better Auth), audit_log

## What's Missing (Build New)

### 1. `pending_orders` table
Reason: Current flow loses checkout intent — no record between "user clicked Buy" and IPN arrival. Needed for:
- Status polling on success page
- Reconciling abandoned carts
- Yearly/monthly period storage
- Idempotency at order level (before payment_id exists)

Schema:
```sql
CREATE TABLE pending_orders (
  order_id TEXT PRIMARY KEY,           -- sophia_${userId}_${ts}
  user_id TEXT NOT NULL,
  tier TEXT NOT NULL,                  -- BASIC|PREMIUM|ENTERPRISE|MASTER
  period TEXT NOT NULL,                -- monthly|yearly|lifetime
  payment_method TEXT NOT NULL,        -- nowpayments|payos
  amount_usd_cents INTEGER NOT NULL,
  promo_code TEXT,
  customer_email TEXT,
  invoice_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|completed|failed|expired
  payment_id TEXT,                     -- linked on IPN finished
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE INDEX idx_pending_orders_user ON pending_orders(user_id);
CREATE INDEX idx_pending_orders_status ON pending_orders(status);
```

### 2. Yearly Pricing Tier Variants
Reason: No yearly invoice IDs in NOWPAYMENTS_TIERS today. If yearly = scope, must:
- Create yearly invoice IDs in NOWPayments dashboard (manual setup)
- Extend NOWPAYMENTS_TIERS to `{ monthly, yearly }` keyed structure
- Or: use NOWPayments dynamic invoice creation API (skip dashboard step)

### 3. PayOS Integration (Optional, behind FEATURE_PAYOS flag)
Reason: VN domestic payments via QR. Requires:
- PayOS client wrapper (env: PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY)
- /api/webhooks/payos/route.ts with HMAC verification (PayOS uses HMAC-SHA256)
- Currency conversion USD → VND at checkout

### 4. Checkout Status Endpoint
Reason: Success page needs to verify activation, not just trust NOWPayments redirect.
- GET /api/checkout/status?order_id=... → { status, tier, completed_at, payment_id }
- Reads pending_orders + cross-checks subscriptions table

### 5. Receipt Email
Reason: Handover email = onboarding magic link, not a receipt with line items.
- New template: `receipt-email.ts` (Resend) — invoice number, amount, payment method, period, tax notice, support link
- Triggered from handleFinished() after auto-handover succeeds

## Risk Notes

1. **IPN replay attacks**: payment_events table already has UNIQUE event_id constraint; isPaymentProcessed() checks before dispatch. Confirmed idempotent at IPN level.
2. **Concurrent tier upgrades**: handleFinished() does single-row update on subscriptions — no explicit transaction. D1 SQLite operates with implicit serialization but multi-statement upsert isn't atomic. For BASIC → PREMIUM during upgrade-while-existing-active, last-write-wins is acceptable (timestamps differ).
3. **HMAC sig already verified** but validate via test that constant-time comparison works on Cloudflare Workers Edge runtime (no Node Buffer.timingSafeEqual).
4. **PlanUpgradeWidget** uses raw NOWPayments URL without order_id — IPN can't track who upgraded. Must route through POST /api/checkout to get tracked URL.
5. **Success page is optimistic** — doesn't verify payment actually completed. NOWPayments redirects to success_url even on `confirming` status. Need polling.

## Unresolved Questions

1. **Yearly pricing scope**: Goal #1 says monthly + yearly toggle. Do we (a) pre-create yearly invoice IDs in NOWPayments dashboard, (b) use dynamic invoice API, or (c) defer yearly to later phase? **Recommend defer** — current MVP is monthly + lifetime (MASTER). Yearly = +20% scope, not core gap.
2. **PayOS scope**: Optional behind feature flag. Recommend Phase 4 stub-only (interface + flag plumbing) and full implementation deferred unless VN traffic justifies. **Recommend stub** for 6h budget.
3. **Receipt email**: Resend already integrated. Confirm tax/legal language with user (no VAT for crypto-USDT? VND has VAT obligations).
4. **Dashboard widget refactor**: Should we replace direct invoice URL with tracked POST? Affects existing settings page UX. **Recommend yes** — single tracked path.
