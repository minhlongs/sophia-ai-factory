---
title: "Phase 4 — Webhook Handler"
priority: P1
status: completed
effort: 2h
---

# PHASE 4 — WEBHOOK HANDLER

## Overview

Create webhook handler for Polar.sh events (subscription.created, order.paid) with signature verification and MCU crediting.

## Files to Create

### app/api/webhooks/polar/route.ts

```typescript
/**
 * POST /api/webhooks/polar
 *
 * Handles Polar.sh webhook events:
 * - subscription.created: New subscription created
 * - subscription.updated: Subscription modified
 * - subscription.deleted: Subscription cancelled
 * - order.paid: Payment successful (credit MCU)
 * - order.refunded: Payment refunded (deduct MCU)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { getPolarClient, PolarWebhookEvent } from '@/lib/billing/polar-client';
import { getTierByProductId } from '@/lib/billing/mcu-pricing';

export async function POST(request: NextRequest) {
  try {
    // 1. Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-polar-signature') || '';

    // 2. Verify webhook signature
    const polarClient = getPolarClient();
    const isValid = polarClient.verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // 3. Parse webhook event
    let event: PolarWebhookEvent;
    try {
      event = JSON.parse(rawBody);
    } catch (error) {
      console.error('Failed to parse webhook payload:', error);
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    console.log(`Processing Polar webhook: ${event.type}`);

    // 4. Route to handler based on event type
    switch (event.type) {
      case 'subscription.created':
        await handleSubscriptionCreated(event);
        break;
      case 'subscription.updated':
        await handleSubscriptionUpdated(event);
        break;
      case 'subscription.deleted':
        await handleSubscriptionDeleted(event);
        break;
      case 'order.paid':
        await handleOrderPaid(event);
        break;
      case 'order.refunded':
        await handleOrderRefunded(event);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // 5. Return success
    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);

    // Return 200 to prevent Polar from retrying on known errors
    if (error instanceof WebhookKnownError) {
      console.error('Known webhook error (not retrying):', error.message);
      return NextResponse.json({ received: true, error: error.message });
    }

    // Return 500 for unknown errors (Polar will retry)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Custom error class for known errors (no retry)
class WebhookKnownError extends Error {}

/**
 * Handle subscription.created event
 */
async function handleSubscriptionCreated(event: PolarWebhookEvent) {
  const supabase = createServerClient();
  const attrs = event.data.attributes as Record<string, unknown>;

  const subscriptionId = attrs.id as string;
  const customerId = attrs.customer_id as string;
  const productId = attrs.product_id as string;
  const status = attrs.status as string;

  // Get tier info from product ID
  const tier = getTierByProductId(productId);
  if (!tier) {
    throw new WebhookKnownError(`Unknown product ID: ${productId}`);
  }

  // Upsert subscription record
  const { error } = await supabase.from('subscriptions').upsert({
    polar_subscription_id: subscriptionId,
    polar_customer_id: customerId,
    polar_product_id: productId,
    tier_name: tier.name,
    status: status,
    mcu_monthly: tier.mcuMonthly,
    mcu_overage_rate: tier.mcuOverageRate,
    current_period_start: attrs.current_period_start as string || null,
    current_period_end: attrs.current_period_end as string || null,
    cancel_at_period_end: attrs.cancel_at_period_end as boolean || false,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'polar_subscription_id'
  });

  if (error) {
    throw new Error(`Failed to create subscription: ${error.message}`);
  }

  console.log(`Subscription created: ${subscriptionId} (${tier.name})`);
}

/**
 * Handle subscription.updated event
 */
async function handleSubscriptionUpdated(event: PolarWebhookEvent) {
  const supabase = createServerClient();
  const attrs = event.data.attributes as Record<string, unknown>;

  const subscriptionId = attrs.id as string;
  const status = attrs.status as string;
  const cancelAtPeriodEnd = attrs.cancel_at_period_end as boolean;

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status,
      cancel_at_period_end: cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq('polar_subscription_id', subscriptionId);

  if (error) {
    throw new Error(`Failed to update subscription: ${error.message}`);
  }

  console.log(`Subscription updated: ${subscriptionId} (status: ${status})`);
}

/**
 * Handle subscription.deleted event
 */
async function handleSubscriptionDeleted(event: PolarWebhookEvent) {
  const supabase = createServerClient();
  const attrs = event.data.attributes as Record<string, unknown>;

  const subscriptionId = attrs.id as string;

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'cancelled',
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('polar_subscription_id', subscriptionId);

  if (error) {
    throw new Error(`Failed to cancel subscription: ${error.message}`);
  }

  console.log(`Subscription cancelled: ${subscriptionId}`);
}

/**
 * Handle order.paid event (CREDIT MCU)
 */
async function handleOrderPaid(event: PolarWebhookEvent) {
  const supabase = createServerClient();
  const attrs = event.data.attributes as Record<string, unknown>;

  const orderId = attrs.id as string;
  const customerId = attrs.customer_id as string;
  const amount = attrs.amount as number; // In cents

  // Find the organization by Polar customer ID
  const { data: billingSettings } = await supabase
    .from('billing_settings')
    .select('org_id')
    .eq('polar_customer_id', customerId)
    .single();

  if (!billingSettings?.org_id) {
    throw new WebhookKnownError(
      `Organization not found for customer: ${customerId}`
    );
  }

  // Find the subscription to get tier info
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier_name, mcu_monthly')
    .eq('polar_customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!subscription) {
    console.warn(`No subscription found for customer: ${customerId}`);
    // Still credit based on payment amount
  }

  const mcuToCredit = subscription?.mcu_monthly || calculateMcuFromAmount(amount);

  // Credit MCU balance using database function
  const { error } = await supabase.rpc('credit_mcu_balance', {
    p_org_id: billingSettings.org_id,
    p_amount: mcuToCredit,
    p_subscription_id: orderId,
  });

  if (error) {
    throw new Error(`Failed to credit MCU: ${error.message}`);
  }

  console.log(
    `Order paid: ${orderId} - Credited ${mcuToCredit} MCU to org ${billingSettings.org_id}`
  );

  // TODO: Send welcome email after first payment
  // await sendWelcomeEmail(billingSettings.org_id);
}

/**
 * Handle order.refunded event (DEDUCT MCU)
 */
async function handleOrderRefunded(event: PolarWebhookEvent) {
  const supabase = createServerClient();
  const attrs = event.data.attributes as Record<string, unknown>;

  const orderId = attrs.id as string;
  const customerId = attrs.customer_id as string;
  const amount = attrs.amount as number;

  // Find the organization
  const { data: billingSettings } = await supabase
    .from('billing_settings')
    .select('org_id')
    .eq('polar_customer_id', customerId)
    .single();

  if (!billingSettings?.org_id) {
    throw new WebhookKnownError(
      `Organization not found for customer: ${customerId}`
    );
  }

  // Calculate MCU to deduct (reverse of credit)
  const mcuToDeduct = calculateMcuFromAmount(amount);

  // Deduct from balance (can go negative for refunds)
  const { error } = await supabase
    .from('org_balances')
    .update({
      balance: supabase.raw('balance - ?', mcuToDeduct),
      last_updated: new Date().toISOString(),
    })
    .eq('org_id', billingSettings.org_id);

  if (error) {
    throw new Error(`Failed to deduct MCU: ${error.message}`);
  }

  console.log(
    `Order refunded: ${orderId} - Deducted ${mcuToDeduct} MCU from org ${billingSettings.org_id}`
  );
}

/**
 * Calculate MCU from payment amount (fallback)
 */
function calculateMcuFromAmount(amountCents: number): number {
  // Rough calculation: $1 = 20 MCU (adjust based on pricing)
  const amountDollars = amountCents / 100;
  return Math.floor(amountDollars * 20);
}
```

## Implementation Steps

1. Create `app/api/webhooks/polar/route.ts`
2. Configure Polar.sh webhook endpoint in dashboard
3. Test webhook signature verification
4. Test MCU crediting on order.paid
5. Test subscription lifecycle events

## Polar Webhook Configuration

In Polar.sh Dashboard:
1. Go to Settings → Webhooks
2. Add endpoint: `https://sophia.agencyos.network/api/webhooks/polar`
3. Select events:
   - subscription.created
   - subscription.updated
   - subscription.deleted
   - order.paid
   - order.refunded
4. Copy webhook secret to `POLAR_WEBHOOK_SECRET`

## Testing Commands

```bash
# Test webhook locally (use Polar CLI or ngrok)
ngrok http 3000

# Then configure Polar webhook to: https://YOUR_NGROK_URL/api/webhooks/polar

# Simulate webhook event
curl -X POST http://localhost:3000/api/webhooks/polar \
  -H "Content-Type: application/json" \
  -H "X-Polar-Signature: t=TIMESTAMP,v1=SIGNATURE" \
  -d @test-polar-order-paid.json
```

## Success Criteria

- [x] Webhook signature verification working
- [x] subscription.created creates DB record
- [x] order.paid credits MCU balance
- [x] order.refunded deducts MCU
- [x] Proper error handling and logging

**Completed:** 2026-03-20

## Related Files

- Webhook Handler: `app/api/webhooks/polar/route.ts`
- Polar Client: `lib/billing/polar-client.ts`
- Database Functions: `lib/supabase/migrations/004_billing_tables.sql`
