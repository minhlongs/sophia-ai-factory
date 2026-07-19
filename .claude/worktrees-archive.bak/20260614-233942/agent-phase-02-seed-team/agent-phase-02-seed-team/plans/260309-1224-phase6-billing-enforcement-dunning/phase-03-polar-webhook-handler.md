---
title: "Phase 3: Polar Webhook Handler"
description: "Handle Polar.sh payment webhooks for dunning workflow integration"
status: pending
priority: P2
effort: 2h
parent: ../plan.md
---

# Phase 3: Polar Webhook Handler

## Overview

Implement webhook handler for Polar.sh payment events to integrate with the dunning workflow, similar to the existing Stripe webhook handler.

## Current State

**Existing:**
- `src/lib/payments/stripe-webhook-handler.ts` - Stripe webhook processor
- `src/lib/payments/polar-webhook-handler.ts` - Basic Polar webhook handler (may exist)
- `src/lib/billing/dunning-workflow.ts` - `handlePaymentFailure()` and `handlePaymentSuccess()`
- `src/app/api/webhooks/stripe/route.ts` - Stripe webhook endpoint

**Gap:** Polar webhooks not integrated with dunning workflow.

## Implementation Steps

### Step 1: Create Polar Webhook Types

**File:** `src/lib/payments/polar-types.ts` (update or create)

```typescript
/**
 * Polar.sh webhook event types
 */

export type PolarEventType =
  | 'payment.created'
  | 'payment.updated'
  | 'payment.paid'
  | 'payment.failed'
  | 'order.created'
  | 'order.updated'
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.active'
  | 'subscription.cancelled'
  | 'subscription.revoked';

export interface PolarWebhookEvent {
  type: PolarEventType;
  created_at: string;
  data: {
    id: string;
    type: string;
    // Payment event fields
    amount?: number;
    currency?: string;
    status?: string;
    failure_reason?: string;
    customer_id?: string;
    subscription_id?: string;
    // Order fields
    customer?: {
      id: string;
      email: string;
    };
    // Subscription fields
    subscription?: {
      id: string;
      status: string;
      current_period_start?: string;
      current_period_end?: string;
    };
    // Metadata
    metadata?: Record<string, string>;
  };
}

export interface PolarPaymentEventRecord {
  id: string;
  event_type: PolarEventType;
  polar_event_id: string;
  payload: Record<string, unknown>;
  processed: boolean;
  created_at: string;
}
```

### Step 2: Create Polar Webhook Handler

**File:** `src/lib/payments/polar-webhook-handler.ts` (NEW/UPDATE)

```typescript
/**
 * Polar.sh Webhook Handler
 *
 * Processes Polar payment events and integrates with dunning workflow
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger-utility';
import { Tier } from '@/types';
import {
  handlePaymentFailure,
  handlePaymentSuccess,
  type DunningStateResult,
} from '@/lib/billing/dunning-workflow';
import {
  sendPaymentFailedEmail,
  sendPaymentSuccessEmail,
} from '@/lib/billing/resend-email-service';
import type { PolarWebhookEvent, PolarPaymentEventRecord } from './polar-types';

/**
 * Verify Polar webhook signature
 */
export function verifyPolarWebhook(
  body: string,
  signature: string,
  webhookSecret: string
): boolean {
  // Polar uses HMAC-SHA256 signatures
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', webhookSecret);
  const expectedSignature = hmac.update(body, 'utf8').digest('hex');

  return signature === `sha256=${expectedSignature}`;
}

/**
 * Check if Polar event was already processed (idempotency)
 */
async function isEventProcessed(polarEventId: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('payment_events')
    .select('processed')
    .eq('polar_event_id', polarEventId)
    .single();

  return data?.processed || false;
}

/**
 * Record Polar event in audit trail
 */
async function recordPolarEvent(event: PolarPaymentEventRecord): Promise<void> {
  const supabase = createAdminClient();

  await supabase.from('payment_events').upsert(
    {
      event_type: event.event_type,
      polar_event_id: event.polar_event_id,
      payload: event.payload,
      processed: event.processed,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'polar_event_id' }
  );
}

/**
 * Find user by Polar customer ID
 */
async function findUserByPolarCustomerId(
  polarCustomerId: string
): Promise<string | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('polar_customer_id', polarCustomerId)
    .single();

  return data?.user_id || null;
}

/**
 * Find user by Polar subscription ID
 */
async function findUserByPolarSubscriptionId(
  polarSubscriptionId: string
): Promise<string | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('polar_subscription_id', polarSubscriptionId)
    .single();

  return data?.user_id || null;
}

/**
 * Extract tier from Polar metadata
 */
function extractTierFromMetadata(
  metadata?: Record<string, string>
): Tier | null {
  if (!metadata?.tier) return null;

  const tier = metadata.tier.toUpperCase();
  if (['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'].includes(tier)) {
    return tier as Tier;
  }

  return null;
}

/**
 * Handle payment.failed event
 */
async function handlePaymentFailed(data: PolarWebhookEvent['data']): Promise<void> {
  const startTime = Date.now();
  const polarCustomerId = data.customer_id;

  if (!polarCustomerId) {
    logger.warn('[Polar] Payment failed: no customer ID');
    return;
  }

  try {
    const supabase = createAdminClient();

    // Find user
    const targetUserId = await findUserByPolarCustomerId(polarCustomerId);

    if (!targetUserId) {
      logger.warn('[Polar] Payment failed: user not found', {
        polarCustomerId,
      });
      return;
    }

    // Get license
    const { data: license } = await supabase
      .from('raas_licenses')
      .select('nonce, tier')
      .eq('created_by', targetUserId)
      .eq('is_revoked', false)
      .single();

    if (!license) {
      logger.warn('[Polar] Payment failed: no active license found', {
        userId: targetUserId,
      });
      return;
    }

    const licenseNonce = license.nonce;
    const tier = (license.tier || 'BASIC').toUpperCase() as Tier;

    // Call dunning workflow
    await handlePaymentFailure({
      userId: targetUserId,
      licenseNonce,
      tier,
      amount: data.amount || 0,
      currency: data.currency || 'usd',
      failureReason: data.failure_reason || 'Payment failed',
      paymentProvider: 'polar',
      polarOrderId: data.id,
    });

    // Send email
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('user_id', targetUserId)
      .single();

    if (userProfile?.email) {
      await sendPaymentFailedEmail({
        userId: targetUserId,
        userEmail: userProfile.email,
        licenseNonce,
        tier,
        amount: data.amount || 0,
        currency: data.currency || 'usd',
        failureReason: data.failure_reason,
        paymentProvider: 'polar',
      });
    }

    // Log to billing_events
    await supabase.from('billing_events').insert({
      user_id: targetUserId,
      license_nonce: licenseNonce,
      event_type: 'invoice_payment_failed',
      event_category: 'payment',
      event_data: {
        polar_order_id: data.id,
        amount: data.amount,
        currency: data.currency,
        failure_reason: data.failure_reason,
      },
      amount: data.amount,
      currency: data.currency,
      payment_provider: 'polar',
      provider_event_id: data.id,
      processed: true,
      processed_at: new Date().toISOString(),
    } as any);

    const duration = Date.now() - startTime;
    logger.info('[Polar] Payment failed handled', {
      userId: targetUserId,
      licenseNonce: licenseNonce.slice(0, 8),
      durationMs: duration,
    });
  } catch (error) {
    logger.error('[Polar] Failed to handle payment failed', error as Error);
    throw error;
  }
}

/**
 * Handle payment.paid event
 */
async function handlePaymentPaid(data: PolarWebhookEvent['data']): Promise<void> {
  const startTime = Date.now();
  const polarCustomerId = data.customer_id;

  if (!polarCustomerId) {
    logger.warn('[Polar] Payment paid: no customer ID');
    return;
  }

  try {
    const supabase = createAdminClient();

    // Find user
    const targetUserId = await findUserByPolarCustomerId(polarCustomerId);

    if (!targetUserId) {
      logger.warn('[Polar] Payment paid: user not found', {
        polarCustomerId,
      });
      return;
    }

    // Get license
    const { data: license } = await supabase
      .from('raas_licenses')
      .select('nonce, tier')
      .eq('created_by', targetUserId)
      .eq('is_revoked', false)
      .single();

    if (!license) {
      logger.warn('[Polar] Payment paid: no active license found', {
        userId: targetUserId,
      });
      return;
    }

    const licenseNonce = license.nonce;
    const tier = (license.tier || 'BASIC').toUpperCase() as Tier;

    // Call dunning workflow - restore access
    await handlePaymentSuccess({
      userId: targetUserId,
      licenseNonce,
      tier,
      amount: data.amount || 0,
      currency: data.currency || 'usd',
      paymentProvider: 'polar',
      providerChargeId: data.id,
    });

    // Send email
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('user_id', targetUserId)
      .single();

    if (userProfile?.email) {
      await sendPaymentSuccessEmail({
        userId: targetUserId,
        userEmail: userProfile.email,
        licenseNonce,
        tier,
        amount: data.amount || 0,
        currency: data.currency || 'usd',
        paymentProvider: 'polar',
      });
    }

    // Log to billing_events
    await supabase.from('billing_events').insert({
      user_id: targetUserId,
      license_nonce: licenseNonce,
      event_type: 'invoice_payment_succeeded',
      event_category: 'payment',
      event_data: {
        polar_order_id: data.id,
        amount: data.amount,
        currency: data.currency,
      },
      amount: data.amount,
      currency: data.currency,
      payment_provider: 'polar',
      provider_event_id: data.id,
      provider_charge_id: data.id,
      processed: true,
      processed_at: new Date().toISOString(),
    } as any);

    const duration = Date.now() - startTime;
    logger.info('[Polar] Payment paid handled', {
      userId: targetUserId,
      licenseNonce: licenseNonce.slice(0, 8),
      durationMs: duration,
    });
  } catch (error) {
    logger.error('[Polar] Failed to handle payment paid', error as Error);
    throw error;
  }
}

/**
 * Handle subscription events
 */
async function handleSubscriptionUpdated(
  data: PolarWebhookEvent['data']
): Promise<void> {
  const polarSubscriptionId = data.subscription?.id;

  if (!polarSubscriptionId) return;

  const targetUserId = await findUserByPolarSubscriptionId(polarSubscriptionId);

  if (!targetUserId) {
    logger.warn('[Polar] Subscription updated: user not found', {
      polarSubscriptionId,
    });
    return;
  }

  const supabase = createAdminClient();
  const status = data.subscription?.status;

  // Update user profile
  await supabase
    .from('user_profiles')
    .update({
      subscription_status: status,
      subscription_expires_at: data.subscription?.current_period_end
        ? new Date(data.subscription.current_period_end).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq('user_id', targetUserId);

  logger.info('[Polar] Subscription updated', {
    userId: targetUserId,
    polarSubscriptionId,
    status,
  });
}

/**
 * Main webhook processor
 */
export async function processPolarWebhookEvent(
  event: PolarWebhookEvent,
  rawBody: string
): Promise<{ success: boolean; message: string }> {
  const startTime = Date.now();
  const eventId = event.data.id;
  const eventType = event.type;

  logger.info('[Polar] Processing webhook event', {
    eventType,
    eventId,
  });

  // Idempotency check
  if (await isEventProcessed(eventId)) {
    return { success: true, message: 'Event already processed' };
  }

  // Record event as pending
  await recordPolarEvent({
    id: crypto.randomUUID(),
    event_type: eventType,
    polar_event_id: eventId,
    payload: event as unknown as Record<string, unknown>,
    processed: false,
    created_at: new Date().toISOString(),
  });

  try {
    // Route to handler
    switch (eventType) {
      case 'payment.failed':
        await handlePaymentFailed(event.data);
        break;

      case 'payment.paid':
        await handlePaymentPaid(event.data);
        break;

      case 'subscription.created':
      case 'subscription.updated':
      case 'subscription.active':
      case 'subscription.cancelled':
        await handleSubscriptionUpdated(event.data);
        break;

      default:
        logger.warn('[Polar] Unhandled event type', { eventType, eventId });
    }

    // Mark as processed
    await recordPolarEvent({
      id: crypto.randomUUID(),
      event_type: eventType,
      polar_event_id: eventId,
      payload: event as unknown as Record<string, unknown>,
      processed: true,
      created_at: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    logger.info('[Polar] Webhook event processed', {
      eventType,
      eventId,
      durationMs: duration,
    });

    return { success: true, message: `Processed ${eventType}` };
  } catch (error) {
    logger.error('[Polar] Failed to process webhook', error as Error);

    // Mark as failed
    await recordPolarEvent({
      id: crypto.randomUUID(),
      event_type: eventType,
      polar_event_id: eventId,
      payload: event as unknown as Record<string, unknown>,
      processed: false,
      created_at: new Date().toISOString(),
    });

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

### Step 3: Create Webhook API Route

**File:** `src/app/api/webhooks/polar/route.ts` (NEW)

```typescript
/**
 * POST /api/webhooks/polar
 *
 * Polar.sh webhook endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { processPolarWebhookEvent } from '@/lib/payments/polar-webhook-handler';
import { verifyPolarWebhook } from '@/lib/payments/polar-webhook-handler';
import type { PolarWebhookEvent } from '@/lib/payments/polar-types';

const POLAR_WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!POLAR_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: 'Configuration Error: POLAR_WEBHOOK_SECRET not set' },
      { status: 500 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get('polar-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing Polar-Signature header' },
      { status: 400 }
    );
  }

  // Verify signature
  try {
    if (!verifyPolarWebhook(body, signature, POLAR_WEBHOOK_SECRET)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Signature verification failed' },
      { status: 400 }
    );
  }

  // Parse event
  let event: PolarWebhookEvent;
  try {
    event = JSON.parse(body) as PolarWebhookEvent;
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // Process event
  try {
    const result = await processPolarWebhookEvent(event, body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    );
  }
}
```

## Environment Variables

Add to `.env`:

```bash
# Polar.sh Webhook
POLAR_WEBHOOK_SECRET=whsec_xxx  # From Polar dashboard
```

## Testing

### Manual Testing

1. Configure Polar webhook endpoint: `https://sophia-ai-factory.vercel.app/api/webhooks/polar`
2. Use Polar dashboard to send test events
3. Verify webhook logs in Supabase `payment_events` table

### Integration Tests

**File:** `src/test/integration/polar-webhook.test.ts`

```typescript
describe('Polar Webhook Integration', () => {
  it('should handle payment.failed event', async () => {
    const response = await fetch('/api/webhooks/polar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'polar-signature': 'sha256=test',
      },
      body: JSON.stringify({
        type: 'payment.failed',
        data: {
          id: 'test-event-id',
          customer_id: 'polar-customer-id',
          amount: 2900,
          currency: 'USD',
          failure_reason: 'card_declined',
        },
      }),
    });

    expect(response.status).toBe(200);
  });
});
```

## Success Criteria

- [ ] Polar webhook handler created with all event types
- [ ] `/api/webhooks/polar` endpoint working
- [ ] Payment.failed triggers dunning workflow
- [ ] Payment.paid restores access
- [ ] Webhook signature verification working
- [ ] Integration tests pass

## Related Files

- `src/lib/payments/polar-webhook-handler.ts` (NEW)
- `src/lib/payments/polar-types.ts` (NEW/UPDATE)
- `src/app/api/webhooks/polar/route.ts` (NEW)
- `src/lib/billing/dunning-workflow.ts` (imported)

---

## Unresolved Questions

1. **Polar webhook secret format** - Need to confirm signature format from Polar docs
2. **Event type mapping** - May need to adjust event types based on actual Polar webhook payload
