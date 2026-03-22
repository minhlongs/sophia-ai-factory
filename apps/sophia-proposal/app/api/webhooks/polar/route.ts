/**
 * POST /api/webhooks/polar
 *
 * Cloudflare Workers compatible — no Node.js crypto, no setInterval,
 * no in-memory state. Uses D1 transactions table for idempotency.
 *
 * Events handled:
 * - subscription.created / updated / deleted
 * - order.paid / order.refunded
 */

import { NextRequest, NextResponse } from 'next/server';
import { getD1Client } from '@/lib/db/client';
import { getPolarClient, PolarWebhookEvent } from '@/lib/billing/polar-client';
import {
  WebhookKnownError,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleOrderPaid,
  handleOrderRefunded,
} from '@/lib/billing/polar-webhook-handlers';

export async function POST(request: NextRequest) {
  try {
    // 1. Read raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-polar-signature') || '';

    // 2. Verify webhook signature (uses CF WebCrypto under the hood)
    const polarClient = getPolarClient();
    const isValid = await polarClient.verifyWebhookSignature(rawBody, signature);

    if (!isValid) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 3. Parse event
    let event: PolarWebhookEvent;
    try {
      event = JSON.parse(rawBody);
    } catch (error) {
      console.error('Failed to parse webhook payload:', error);
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    console.log(`Processing Polar webhook: ${event.type} (id: ${event.data.id})`);

    // 4. Resolve D1 client once — shared across all handlers
    const db = await getD1Client();

    // 5. Route to handler (handlers use transactions table for idempotency)
    switch (event.type) {
      case 'subscription.created':
        await handleSubscriptionCreated(db, event);
        break;
      case 'subscription.updated':
        await handleSubscriptionUpdated(db, event);
        break;
      case 'subscription.deleted':
        await handleSubscriptionDeleted(db, event);
        break;
      case 'order.paid':
        await handleOrderPaid(db, event);
        break;
      case 'order.refunded':
        await handleOrderRefunded(db, event);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);

    // Known errors: return 200 so Polar does not retry
    if (error instanceof WebhookKnownError) {
      console.error('Known webhook error (not retrying):', (error as Error).message);
      return NextResponse.json({ received: true, error: (error as Error).message });
    }

    // Unknown errors: return 500 so Polar retries
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
