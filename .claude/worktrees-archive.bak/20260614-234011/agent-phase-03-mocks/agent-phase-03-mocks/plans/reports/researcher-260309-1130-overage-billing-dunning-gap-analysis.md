# Overage Billing & Dunning Workflow - Gap Analysis

**Date:** 2026-03-09
**Phase:** Phase 6 - ROIaaS Billing Enforcement
**Scope:** Stripe/Polar Metered Usage Webhooks, Dunning State Sync, RaaS Gateway Paywall

---

## 1. Existing Infrastructure (Already Implemented)

### Database Schema ✅
- `overage_events` - Tracks overage usage with billing columns
- `quota_limits` - Quota configuration per tier
- `usage_events` - Real-time usage tracking with idempotency
- `dunning_settings` - Dunning state per license (current/past_due/delinquent/suspended)
- `dunning_attempts` - Payment retry history
- `billing_events` - Audit log for all billing events

### Core Libraries ✅
| File | Status | Features |
|------|--------|----------|
| `src/lib/billing/overage-billing-reconciler.ts` | ✅ Complete | Scan unbilled events, calculate charges, create Stripe/Polar invoice items |
| `src/lib/billing/dunning-workflow.ts` | ✅ Complete | State machine, grace periods, retry scheduling, payment failure/success handlers |
| `src/lib/billing/resend-email-service.ts` | ✅ Complete | Email templates (EN/VI), dunning notifications, overage detected emails |
| `src/lib/billing/polar-metered-billing.ts` | ✅ Complete | Polar API client, usage recording, invoice items, subscription status check |
| `src/lib/quota/quota-checker.ts` | ✅ Complete | Real-time quota checks with overage detection |
| `src/lib/quota/quota-enforcer.ts` | ✅ Complete | Soft/hard paywall enforcement |
| `src/lib/raas-gate.ts` | ✅ Complete | License validation, quota enforcement, Polar subscription check |

### API Endpoints ✅
| Endpoint | Status | Purpose |
|----------|--------|---------|
| `POST /api/webhooks/stripe` | ✅ Complete | Stripe webhook handler |
| `POST /api/webhooks/overage-billing` | ✅ Complete | Overage event ingestion |
| `POST /api/webhooks/polar` | ✅ Complete | Polar webhook handler |
| `GET/POST /api/billing/usage-summary` | ✅ Complete | Usage summary retrieval |
| `POST /api/billing/record-usage` | ✅ Complete | Manual usage recording |

### Migration Files ✅
- `260308-1800-create-overage-events-table.sql`
- `260308-1801-create-quota-limits-table.sql`
- `260309-0931-create-usage-events-table.sql`
- `260309-0932-update-overage-events-add-billing-columns.sql`
- `260309-1100-create-dunning-workflow-tables.sql`

---

## 2. Implementation Gaps (What's Missing)

### Gap 1: Stripe Metered Usage Webhook Handler ⚠️ PARTIAL
**Current State:** `src/app/api/webhooks/stripe/route.ts` exists but delegates to `stripe-webhook-handler.ts`

**Missing:**
- [ ] `invoice.payment_failed` → trigger dunning workflow
- [ ] `invoice.payment_succeeded` → restore dunning state
- [ ] `customer.subscription.updated` → sync subscription status
- [ ] `meter.adjustment` → handle usage adjustments

**Files to Update:**
- `src/lib/payments/stripe-webhook-handler.ts` - Add metered billing event handlers

### Gap 2: Polar Webhook Handler ⚠️ PARTIAL
**Current State:** `src/app/api/webhooks/polar/route.ts` exists

**Missing:**
- [ ] `subscription.created` → initialize dunning settings
- [ ] `subscription.active` → restore access
- [ ] `subscription.past_due` → trigger dunning
- [ ] `order.paid` → sync overage charges

**Files to Update:**
- `src/app/api/webhooks/polar/route.ts` - Add full webhook event handling

### Gap 3: RaaS Gateway Dunning Integration ✅ COMPLETE
**Current State:** `src/lib/raas-gate.ts` already has:
- `canAccessApi()` check from dunning-workflow
- Polar subscription status verification
- Quota enforcement with soft/hard blocks

**No changes needed** - already integrated.

### Gap 4: Dashboard Dunning State Sync ⚠️ MISSING
**Missing API Endpoint:**
- [ ] `GET /api/admin/dunning/:licenseNonce` - Get dunning state for dashboard
- [ ] `GET /api/dashboard/billing/dunning-status` - User-facing dunning status

**Missing UI Components:**
- [ ] `src/components/billing/dunning-status-banner.tsx` - Warning banner for past_due
- [ ] `src/components/billing/payment-history-table.tsx` - Payment attempt history
- [ ] `src/app/[locale]/dashboard/billing/dunning/page.tsx` - Dunning management page

### Gap 5: Cron Jobs for Overage Reconciliation ⚠️ PARTIAL
**Current State:** `src/lib/billing/overage-billing-reconciler.ts` has `reconcileOverageEventsWithRetry()`

**Missing:**
- [ ] `POST /api/cron/overage-billing` - Cron endpoint for daily reconciliation
- [ ] `POST /api/cron/dunning-state-sync` - Cron endpoint for state synchronization

---

## 3. Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    PAYMENT PROVIDERS                            │
│  ┌──────────────┐  ┌──────────────┐                             │
│  │   Stripe     │  │   Polar.sh   │                             │
│  │  Webhooks    │  │  Webhooks    │                             │
│  └──────┬───────┘  └──────┬───────┘                             │
│         │                 │                                      │
│         ▼                 ▼                                      │
│  ┌─────────────────────────────────┐                            │
│  │     /api/webhooks/stripe        │                            │
│  │     /api/webhooks/polar         │                            │
│  └──────────────┬──────────────────┘                            │
│                 │                                                │
│                 ▼                                                │
│  ┌─────────────────────────────────┐                            │
│  │   dunning-workflow.ts           │                            │
│  │   - handlePaymentFailure()      │                            │
│  │   - handlePaymentSuccess()      │                            │
│  │   - getDunningState()           │                            │
│  └──────────────┬──────────────────┘                            │
│                 │                                                │
│                 ▼                                                │
│  ┌─────────────────────────────────┐                            │
│  │   overage-billing-reconciler.ts │                            │
│  │   - scanUnbilledOverageEvents() │                            │
│  │   - calculateOverageCharges()   │                            │
│  │   - createPolarInvoiceItem()    │                            │
│  └──────────────┬──────────────────┘                            │
│                 │                                                │
│                 ▼                                                │
│  ┌─────────────────────────────────┐                            │
│  │   resend-email-service.ts       │                            │
│  │   - sendPaymentFailedEmail()    │                            │
│  │   - sendSuspensionNoticeEmail() │                            │
│  └──────────────┬──────────────────┘                            │
└─────────────────┼───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────┐
│     ENFORCEMENT LAYER           │
│  ┌─────────────────────────┐    │
│  │   raas-gate.ts          │    │
│  │   - dunning state check │    │
│  │   - Polar status check  │    │
│  │   - quota enforcement   │    │
│  └─────────────────────────┘    │
└─────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────┐
│     DASHBOARD SYNC              │
│  ┌─────────────────────────┐    │
│  │   /api/admin/dunning/*  │    │
│  │   /api/dashboard/*      │    │
│  │   Billing UI Components │    │
│  └─────────────────────────┘    │
└─────────────────────────────────┘
```

---

## 4. Priority Implementation List

### P0 - Critical (Blocking)
1. **Stripe webhook handler** - Add `invoice.payment_failed` and `invoice.payment_succeeded` handlers
2. **Polar webhook handler** - Full webhook event processing
3. **Cron endpoint for overage reconciliation** - Daily billing sync

### P1 - High (Core Functionality)
4. **Dashboard dunning status API** - Admin visibility
5. **Dunning state UI components** - User notifications

### P2 - Medium (Enhancements)
6. **SMS notification service** - Alternative to email
7. **Dunning analytics dashboard** - Usage trends, payment success rates

---

## 5. Testing Requirements

### Unit Tests Needed
- [ ] `src/lib/billing/__tests__/stripe-webhook-handler.test.ts`
- [ ] `src/lib/billing/__tests__/polar-webhook-handler.test.ts`
- [ ] `src/lib/billing/__tests__/dunning-state-sync.test.ts`

### Integration Tests Needed
- [ ] `/api/webhooks/stripe` - Full payment flow
- [ ] `/api/webhooks/polar` - Subscription lifecycle
- [ ] `/api/cron/overage-billing` - Reconciliation workflow

---

## 6. Environment Variables Required

```bash
# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_METER_ID=mt_...

# Polar
POLAR_ACCESS_TOKEN=...
POLAR_API_KEY=...
POLAR_ORGANIZATION_ID=...
POLAR_METER_SLUGS=api_credits,api_requests

# Resend Email
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=billing@sophia.agencyos.network

# Cron Security
CRON_SECRET=...
CLOUDFLARE_QUEUE_SECRET=...
```

---

## 7. Unresolved Questions

1. **SMS Provider:** Should we use Twilio, SendGrid, or Resend SMS for dunning notifications?
2. **Grace Period Customization:** Should agencies be able to customize grace periods per tenant?
3. **Overage Billing Timing:** Bill immediately on overage detected vs. end-of-month reconciliation?
4. **Polar vs Stripe Priority:** If both configured, which takes precedence for billing?
