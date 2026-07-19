# Phase 1: Stripe Webhook Handler for Metered Billing

**Priority:** P0 - Critical
**Estimated Time:** 45 minutes
**Status:** Pending

---

## Context Links

- Parent Plan: `/plans/260309-1130-overage-billing-dunning-workflow/plan.md`
- Gap Analysis: `/plans/reports/researcher-260309-1130-overage-billing-dunning-gap-analysis.md`
- Related Code:
  - `src/lib/payments/stripe-webhook-handler.ts`
  - `src/lib/payments/stripe-webhook-verify.ts`
  - `src/lib/billing/dunning-workflow.ts`
  - `src/lib/billing/resend-email-service.ts`

---

## Overview

Implement Stripe webhook event handlers for metered billing events:
- `invoice.payment_failed` → Trigger dunning workflow
- `invoice.payment_succeeded` → Restore dunning state
- `customer.subscription.updated` → Sync subscription status
- `meter.adjustment` → Handle usage adjustments

---

## Key Insights

From gap analysis:
- Stripe webhook handler exists but only delegates to modular handler
- `dunning-workflow.ts` already has `handlePaymentFailure()` and `handlePaymentSuccess()`
- `resend-email-service.ts` already has email templates
- Need to connect Stripe events → dunning workflow → email notifications

---

## Requirements

### Functional Requirements
1. **Payment Failed Handler:**
   - Extract customer ID, amount, failure reason from Stripe event
   - Lookup user by `stripe_customer_id` in database
   - Call `handlePaymentFailure()` from dunning-workflow
   - Send payment failed email via Resend
   - Log to `billing_events` table

2. **Payment Succeeded Handler:**
   - Extract customer ID, amount, charge ID from Stripe event
   - Lookup user by `stripe_customer_id`
   - Call `handlePaymentSuccess()` from dunning-workflow
   - Send payment success email via Resend
   - Log to `billing_events` table

3. **Subscription Updated Handler:**
   - Sync subscription status to `dunning_settings` table
   - Handle status changes: `active` → `past_due` → `canceled`

4. **Meter Adjustment Handler:**
   - Handle Stripe meter adjustments/credits
   - Log to `usage_events` table for audit

### Non-Functional Requirements
- Idempotency: Handle duplicate webhook events
- Error handling: Retry on transient failures
- Logging: All events logged to `billing_events` table
- Security: Verify Stripe signature before processing

---

## Architecture

```
Stripe Webhook
     │
     ▼
/api/webhooks/stripe (route.ts)
     │
     ▼
processStripeWebhookEvent (stripe-webhook-handler.ts)
     │
     ├── invoice.payment_failed
     │       │
     │       ├── handleInvoicePaymentFailed()
     │       │       │
     │       │       ├── Lookup user by stripe_customer_id
     │       │       │
     │       │       ├── handlePaymentFailure() ← dunning-workflow.ts
     │       │       │
     │       │       └── sendPaymentFailedEmail() ← resend-email-service.ts
     │       │
     │       └── Log to billing_events
     │
     ├── invoice.payment_succeeded
     │       │
     │       ├── handleInvoicePaymentSucceeded()
     │       │       │
     │       │       ├── Lookup user by stripe_customer_id
     │       │       │
     │       │       ├── handlePaymentSuccess() ← dunning-workflow.ts
     │       │       │
     │       │       └── sendPaymentSuccessEmail() ← resend-email-service.ts
     │       │
     │       └── Log to billing_events
     │
     ├── customer.subscription.updated
     │       │
     │       └── handleSubscriptionUpdated()
     │               │
     │               └── Sync to dunning_settings
     │
     └── meter.adjustment
             │
             └── handleMeterAdjustment()
                     │
                     └── Log to usage_events
```

---

## Related Code Files

### Files to Create
- `src/lib/payments/stripe-metered-webhook.ts` (NEW - metered billing handlers)

### Files to Update
- `src/lib/payments/stripe-webhook-handler.ts` (UPDATE - add event routing)
- `src/lib/payments/stripe-webhook-verify.ts` (UPDATE - if needed for signature verification)

---

## Implementation Steps

### Step 1: Create Stripe Metered Webhook Handler

Create `src/lib/payments/stripe-metered-webhook.ts`:

```typescript
/**
 * Stripe Metered Webhook Handlers
 *
 * Handle Stripe billing events:
 * - invoice.payment_failed
 * - invoice.payment_succeeded
 * - customer.subscription.updated
 * - meter.adjustment
 */

import Stripe from 'stripe';
import { handlePaymentFailure, handlePaymentSuccess } from '@/lib/billing/dunning-workflow';
import { sendPaymentFailedEmail, sendPaymentSuccessEmail } from '@/lib/billing/resend-email-service';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';

export interface StripeWebhookResult {
  success: boolean;
  message?: string;
  retryable?: boolean;
}

/**
 * Handle invoice.payment_failed event
 */
export async function handleInvoicePaymentFailed(
  event: Stripe.Event
): Promise<StripeWebhookResult>;

/**
 * Handle invoice.payment_succeeded event
 */
export async function handleInvoicePaymentSucceeded(
  event: Stripe.Event
): Promise<StripeWebhookResult>;

/**
 * Handle customer.subscription.updated event
 */
export async function handleSubscriptionUpdated(
  event: Stripe.Event
): Promise<StripeWebhookResult>;

/**
 * Handle meter.adjustment event
 */
export async function handleMeterAdjustment(
  event: Stripe.Event
): Promise<StripeWebhookResult>;
```

### Step 2: Implement Payment Failed Handler

```typescript
export async function handleInvoicePaymentFailed(
  event: Stripe.Event
): Promise<StripeWebhookResult> {
  const invoice = event.data.object as Stripe.Invoice;

  // Get customer ID
  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id;

  if (!customerId) {
    logger.warn('[Stripe Webhook] No customer ID in invoice');
    return { success: false, message: 'No customer ID' };
  }

  // Lookup user by stripe_customer_id
  const supabase = createAdminClient();
  const { data: license } = await supabase
    .from('raas_licenses')
    .select('nonce, created_by, tier')
    .eq('polar_customer_id', customerId)
    .single();

  if (!license) {
    logger.warn('[Stripe Webhook] No license found for customer', { customerId });
    return { success: false, message: 'License not found' };
  }

  const userId = license.created_by;
  const licenseNonce = license.nonce;
  const tier = (license.tier || 'BASIC').toUpperCase();

  // Call dunning workflow
  await handlePaymentFailure({
    userId,
    licenseNonce,
    tier,
    amount: invoice.amount_due || 0,
    currency: invoice.currency || 'usd',
    failureReason: invoice.charge?.failure_message || 'Unknown',
    paymentProvider: 'stripe',
    stripeInvoiceId: invoice.id,
  });

  // Send email notification
  const { data: user } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();

  if (user?.email) {
    await sendPaymentFailedEmail({
      userId,
      userEmail: user.email,
      licenseNonce,
      tier,
      amount: invoice.amount_due || 0,
      currency: invoice.currency || 'usd',
      failureReason: invoice.charge?.failure_message || 'Unknown',
      paymentProvider: 'stripe',
    });
  }

  // Log to billing_events
  await supabase.from('billing_events').insert({
    user_id: userId,
    license_nonce: licenseNonce,
    event_type: 'invoice_payment_failed',
    event_category: 'payment',
    event_data: {
      stripe_invoice_id: invoice.id,
      amount: invoice.amount_due,
      currency: invoice.currency,
      failure_reason: invoice.charge?.failure_message,
    },
    amount: invoice.amount_due,
    currency: invoice.currency,
    payment_provider: 'stripe',
    provider_event_id: invoice.id,
    processed: true,
    processed_at: new Date().toISOString(),
  });

  logger.info('[Stripe Webhook] Payment failed handled', {
    userId,
    licenseNonce: licenseNonce.slice(0, 8),
    amount: invoice.amount_due,
  });

  return { success: true };
}
```

### Step 3: Implement Payment Succeeded Handler

```typescript
export async function handleInvoicePaymentSucceeded(
  event: Stripe.Event
): Promise<StripeWebhookResult> {
  const invoice = event.data.object as Stripe.Invoice;

  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id;

  if (!customerId) {
    return { success: false, message: 'No customer ID' };
  }

  // Lookup user (same as failed handler)
  const supabase = createAdminClient();
  const { data: license } = await supabase
    .from('raas_licenses')
    .select('nonce, created_by, tier')
    .eq('polar_customer_id', customerId)
    .single();

  if (!license) {
    return { success: false, message: 'License not found' };
  }

  const userId = license.created_by;
  const licenseNonce = license.nonce;
  const tier = (license.tier || 'BASIC').toUpperCase();

  // Get charge ID
  const chargeId = typeof invoice.char === 'string'
    ? invoice.charge
    : invoice.charge?.id;

  // Call dunning workflow
  await handlePaymentSuccess({
    userId,
    licenseNonce,
    tier,
    amount: invoice.amount_due || 0,
    currency: invoice.currency || 'usd',
    paymentProvider: 'stripe',
    providerChargeId: chargeId || invoice.id,
  });

  // Send email notification
  const { data: user } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();

  if (user?.email) {
    await sendPaymentSuccessEmail({
      userId,
      userEmail: user.email,
      licenseNonce,
      tier,
      amount: invoice.amount_due || 0,
      currency: invoice.currency || 'usd',
      paymentProvider: 'stripe',
    });
  }

  // Log to billing_events
  await supabase.from('billing_events').insert({
    user_id: userId,
    license_nonce: licenseNonce,
    event_type: 'invoice_payment_succeeded',
    event_category: 'payment',
    event_data: {
      stripe_invoice_id: invoice.id,
      stripe_charge_id: chargeId,
      amount: invoice.amount_due,
      currency: invoice.currency,
    },
    amount: invoice.amount_due,
    currency: invoice.currency,
    payment_provider: 'stripe',
    provider_event_id: invoice.id,
    provider_charge_id: chargeId,
    processed: true,
    processed_at: new Date().toISOString(),
  });

  return { success: true };
}
```

### Step 4: Implement Subscription Updated Handler

### Step 5: Implement Meter Adjustment Handler

### Step 6: Update Main Webhook Handler

Update `src/lib/payments/stripe-webhook-handler.ts` to route events to new handlers.

---

## Success Criteria

- [ ] Webhook events processed correctly
- [ ] Dunning state transitions on payment failure
- [ ] Email notifications sent
- [ ] Billing events logged to database
- [ ] Idempotency: duplicate events handled

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Customer lookup fails | Log warning, return success (acknowledge webhook) |
| Email send fails | Continue processing, log error |
| Database error | Return retryable error, webhook will retry |
| Duplicate events | Idempotency via dunning-workflow state checks |

---

## Next Steps

After this phase:
1. Test with Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
2. Trigger test events: `stripe trigger invoice.payment_failed`
3. Verify dunning state transition in Supabase dashboard
