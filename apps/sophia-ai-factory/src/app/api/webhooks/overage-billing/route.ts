/**
 * Overage Billing Webhook Handler
 *
 * Processes overage events from Cloudflare Worker queue
 * and syncs to Supabase usage_events table.
 * Supports standard webhook and Cloudflare signatures for verification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { verifySignature, verifyCloudflareSignature } from './overage-billing-signature-verifier';
import {
  overageEventSchema,
  headerSchema,
  checkIdempotency,
  storeUsageEvent,
  logOverageEvent,
} from './overage-billing-event-store';

/**
 * POST handler for overage billing webhook
 */
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.OVERAGE_WEBHOOK_SECRET;
  const cloudflareSecret = process.env.CLOUDFLARE_QUEUE_SECRET;

  try {
    // Parse headers
    const rawHeaders: Record<string, string | undefined> = {
      'webhook-id': request.headers.get('webhook-id') || undefined,
      'webhook-timestamp': request.headers.get('webhook-timestamp') || undefined,
      'webhook-signature': request.headers.get('webhook-signature') || undefined,
      'X-Cloudflare-Signature': request.headers.get('X-Cloudflare-Signature') || undefined
    };

    // Validate headers
    const headerValidation = headerSchema.safeParse(rawHeaders);
    if (!headerValidation.success) {
      return NextResponse.json({
        error: 'Invalid headers',
        details: headerValidation.error.message
      }, { status: 400 });
    }

    // Get raw body
    const body = await request.text();

    // Verify signature based on source
    const cloudflareSig = rawHeaders['X-Cloudflare-Signature'];
    if (cloudflareSig && cloudflareSecret) {
      if (!verifyCloudflareSignature(cloudflareSig, cloudflareSecret)) {
        return NextResponse.json({ error: 'Invalid Cloudflare signature' }, { status: 400 });
      }
    } else if (webhookSecret) {
      const isValid = await verifySignature(body, rawHeaders, webhookSecret);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'No webhook secret configured' }, { status: 500 });
    }

    // Parse event
    let event: unknown;
    try {
      event = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Validate event schema
    const parseResult = overageEventSchema.safeParse(event);
    if (!parseResult.success) {
      return NextResponse.json({
        error: 'Invalid event format',
        details: parseResult.error.message
      }, { status: 400 });
    }

    const validatedEvent = parseResult.data;
    const supabase = createServerClient();

    // Check idempotency
    const isDuplicate = await checkIdempotency(validatedEvent.idempotencyKey, supabase);
    if (isDuplicate) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Store event
    const result = await storeUsageEvent(validatedEvent, supabase);
    if (!result.success) {
      return NextResponse.json({
        error: 'Failed to store event',
        details: result.error
      }, { status: 500 });
    }

    // Log overage for billing reconciliation (non-critical)
    await logOverageEvent(validatedEvent, supabase);

    return NextResponse.json({
      received: true,
      processed: true,
      eventId: validatedEvent.idempotencyKey
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET handler for webhook health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoints: {
      overage: '/api/webhooks/overage-billing'
    }
  });
}
