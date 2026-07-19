# Phase 7: Cloudflare Worker for Stripe Webhook Relay

**Priority:** P0 - Critical for Production
**Estimated Time:** 60 minutes
**Status:** Pending

---

## Overview

Deploy Cloudflare Worker at `raas.agencyos.network` to:
1. Receive Stripe webhook events securely
2. Validate Stripe signatures
3. Update dunning state in RaaS Gateway KV
4. Enforce soft/hard paywalls based on dunning duration
5. Trigger email/SMS notifications via AgencyOS
6. Sync subscription status to AgencyOS dashboard

---

## Architecture

```
Stripe Webhooks
     │
     ▼
raas.agencyos.network (Cloudflare Worker)
     │
     ├── Verify Stripe Signature
     │
     ├── Route Events:
     │   ├── invoice.payment_failed → Update KV dunning state
     │   ├── invoice.payment_succeeded → Restore access
     │   └── customer.subscription.updated → Sync status
     │
     ├── Update RaaS Gateway KV:
     │   ├── dunning:{licenseNonce} → state object
     │   └── subscription:{customerId} → status object
     │
     ├── Trigger Notifications:
     │   └── POST https://sophia-ai-factory.vercel.app/api/webhooks/dunning-notification
     │
     └── Sync to Dashboard:
         └── POST https://sophia-ai-factory.vercel.app/api/admin/dunning/sync
```

---

## Files to Create

### Worker Files
- `worker/src/index.ts` - Main worker entry point
- `worker/src/stripe-webhook.ts` - Stripe webhook handler
- `worker/src/dunning-state.ts` - KV state management
- `worker/src/notification-client.ts` - AgencyOS notification client
- `wrangler.toml` - Worker configuration
- `worker-configuration.d.ts` - Type definitions

### Integration Files
- `src/app/api/webhooks/dunning-notification/route.ts` - Receive notification triggers
- `src/app/api/admin/dunning/sync/route.ts` - Dashboard sync endpoint

---

## Environment Variables

```bash
# Worker Environment
STRIPE_WEBHOOK_SECRET=whsec_xxx
RAAS_GATEWAY_KV_NAMESPACE=raas_gateway
AGENCYOS_WEBHOOK_SECRET=agencyos_xxx
AGENCYOS_NOTIFICATION_URL=https://sophia-ai-factory.vercel.app/api/webhooks/dunning-notification

# Sophia AI Factory Environment
WORKER_JWT_SECRET=REDACTED=jwt_xxx  # For verifying worker requests
```

---

## Implementation Steps

### Step 1: Create Worker Project Structure

### Step 2: Implement Stripe Signature Verification

### Step 3: Implement KV State Management

### Step 4: Implement Notification Client

### Step 5: Deploy Worker to Cloudflare

### Step 6: Create Sophia AI Factory Endpoints

### Step 7: Test End-to-End Flow

---

## Testing

```bash
# Test Stripe webhook
stripe listen --forward-to https://raas.agencyos.network/webhook

# Trigger test events
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.updated
```

---

## Success Criteria

- [ ] Worker deployed at `raas.agencyos.network`
- [ ] Stripe events received and validated
- [ ] Dunning state updated in KV within 100ms
- [ ] Notifications triggered within 500ms
- [ ] Dashboard sync completes successfully
- [ ] Idempotency: duplicate events handled
