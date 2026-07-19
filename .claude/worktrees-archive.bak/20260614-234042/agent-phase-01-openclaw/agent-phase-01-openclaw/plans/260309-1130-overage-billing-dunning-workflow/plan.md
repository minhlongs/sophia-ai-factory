# Phase 6: Overage Billing & Dunning Workflow - Implementation Plan

**Created:** 2026-03-09
**Status:** Pending Approval
**Priority:** P0 - Critical for ROIaaS Billing

---

## Overview

Implement complete overage billing and dunning workflow for Phase 6:
1. Stripe Billing Metered Usage webhooks → detect usage beyond limits
2. Customer notifications via email (Resend)
3. Soft/hard paywall gates in RaaS Gateway based on dunning status
4. Dunning state sync to AgencyOS dashboard

**Dual-Stream ROI:**
- **Engineering ROI:** RaaS API key gate for premium CLI/agents
- **Operational ROI:** Subscription webhooks → dunning state enforcement

---

## Implementation Phases

### Phase 1: Stripe Webhook Handler (P0)
**Goal:** Handle `invoice.payment_failed` and `invoice.payment_succeeded` events

**Files to Create/Update:**
- `src/lib/payments/stripe-metered-webhook.ts` (NEW)
- `src/lib/payments/stripe-webhook-handler.ts` (UPDATE)

**Tasks:**
- [ ] 1.1: Add `handleInvoicePaymentFailed()` - trigger dunning workflow
- [ ] 1.2: Add `handleInvoicePaymentSucceeded()` - restore dunning state
- [ ] 1.3: Add `handleCustomerSubscriptionUpdated()` - sync status
- [ ] 1.4: Update main webhook handler to route events

**Success Criteria:**
- Webhook events logged to `billing_events` table
- Dunning state transitions correctly on payment failure/success
- Email notifications sent via Resend

---

### Phase 2: Polar Webhook Handler (P0)
**Goal:** Handle Polar subscription lifecycle events

**Files to Create/Update:**
- `src/lib/billing/polar-webhook-handler.ts` (NEW)
- `src/app/api/webhooks/polar/route.ts` (UPDATE)

**Tasks:**
- [ ] 2.1: Implement Polar webhook signature verification
- [ ] 2.2: Add `handleSubscriptionCreated()` - initialize dunning settings
- [ ] 2.3: Add `handleSubscriptionActive()` - restore access
- [ ] 2.4: Add `handleSubscriptionPastDue()` - trigger dunning
- [ ] 2.5: Add `handleOrderPaid()` - sync overage charges

**Success Criteria:**
- Polar webhooks verified with HMAC signature
- Subscription status synced to `dunning_settings` table
- Overage charges recorded as Polar orders

---

### Phase 3: Cron Endpoints for Overage Reconciliation (P0)
**Goal:** Daily automated billing reconciliation

**Files to Create:**
- `src/app/api/cron/overage-billing/route.ts`
- `src/app/api/cron/dunning-state-sync/route.ts`

**Tasks:**
- [ ] 3.1: Create cron endpoint with secret-based auth
- [ ] 3.2: Call `reconcileOverageEventsWithRetry()` daily
- [ ] 3.3: Create dunning state sync cron job
- [ ] 3.4: Add monitoring/logging for cron execution

**Success Criteria:**
- Cron runs daily at 2 AM UTC
- Overage events reconciled and billed
- Failed cron jobs alert admin

---

### Phase 4: Dashboard Dunning State API (P1)
**Goal:** Admin visibility into dunning states

**Files to Create:**
- `src/app/api/admin/dunning/[licenseNonce]/route.ts`
- `src/app/api/dashboard/billing/dunning-status/route.ts`

**Tasks:**
- [ ] 4.1: Create admin API endpoint with Basic Auth
- [ ] 4.2: Create user-facing dunning status endpoint
- [ ] 4.3: Add pagination for dunning history
- [ ] 4.4: Add rate limiting for user endpoints

**Success Criteria:**
- Admin can query any license dunning state
- Users can see their own dunning status
- API responses include grace period end, next retry date

---

### Phase 5: Dunning UI Components (P1)
**Goal:** User-facing billing notifications

**Files to Create:**
- `src/components/billing/dunning-status-banner.tsx`
- `src/components/billing/payment-history-table.tsx`
- `src/components/billing/overage-usage-card.tsx`
- `src/app/[locale]/dashboard/billing/dunning/page.tsx`

**Tasks:**
- [ ] 5.1: Create warning banner for `past_due` state
- [ ] 5.2: Create critical banner for `suspended` state
- [ ] 5.3: Create payment history table with retry dates
- [ ] 5.4: Create overage usage card with fee calculator
- [ ] 5.5: Create dunning management page

**Success Criteria:**
- Users see visual warnings before suspension
- Payment history visible in dashboard
- One-click payment retry button

---

### Phase 6: Integration Testing (P0)
**Goal:** End-to-end workflow verification

**Files to Create:**
- `src/lib/billing/__tests__/overage-billing-integration.test.ts`
- `src/lib/billing/__tests__/dunning-workflow-integration.test.ts`

**Tasks:**
- [ ] 6.1: Test Stripe webhook → dunning transition
- [ ] 6.2: Test Polar webhook → subscription sync
- [ ] 6.3: Test cron job → overage reconciliation
- [ ] 6.4: Test RaaS Gateway → dunning-based blocking
- [ ] 6.5: Test email notifications delivery

**Success Criteria:**
- All integration tests pass (100%)
- CI/CD pipeline green
- Production smoke test passes

---

## Dependencies

```
Phase 1 (Stripe Webhooks) ─┬─> Phase 6 (Testing)
Phase 2 (Polar Webhooks) ──┤
Phase 3 (Cron Jobs) ───────┘

Phase 4 (Dashboard API) ───┬─> Phase 5 (UI Components)
```

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Stripe webhook signature validation fails | High | Low | Use official SDK, test with CLI |
| Polar API rate limiting | Medium | Medium | Implement exponential backoff |
| Email delivery failures | Medium | Low | Log to DB, retry queue |
| Dunning state inconsistency | High | Low | Idempotency keys, transactional updates |
| Cron job timeout | Medium | Medium | Queue-based processing, chunking |

---

## Success Metrics

- **Billing Accuracy:** 100% of overage events billed correctly
- **Dunning Timing:** < 1 second state transition after payment failure
- **Email Delivery:** > 99% delivery rate within 5 minutes
- **API Latency:** < 100ms for dunning state checks in RaaS Gateway
- **Cron Reliability:** 100% successful daily execution

---

## Environment Variables

Add to `.env.example`:

```bash
# Stripe Metered Billing
STRIPE_METER_ID=mt_xxx

# Polar Webhooks
POLAR_WEBHOOK_SECRET=whsec_xxx

# Resend Email
RESEND_FROM_EMAIL=billing@sophia.agencyos.network

# Cron Security
CRON_SECRET=cron_xxx
CLOUDFLARE_QUEUE_SECRET=cf_xxx
```

---

## Unresolved Questions

1. **SMS Provider:** Twilio vs SendGrid vs Resend SMS?
2. **Overage Timing:** Bill immediately vs end-of-month?
3. **Dual Provider:** If both Stripe + Polar configured, which takes precedence?
