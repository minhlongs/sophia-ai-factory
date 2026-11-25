/**
 * Overage Billing Webhook Handler
 *
 * Processes overage events from Cloudflare Worker queue and syncs to D1.
 * Rejects Polar-Signature (banned provider), awaits async HMAC verification,
 * and enforces atomic `payment_events` idempotency before recording overages.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { verifySignature, verifyCloudflareSignature } from './overage-billing-signature-verifier';
import {
  overageEventSchema,
  headerSchema,
  claimOverageWebhookIdempotency,
  finalizeOverageWebhookIdempotency,
  storeUsageEvent,
  logOverageEvent,
  type OverageEvent,
} from './overage-billing-event-store';

async function authenticateOverageWebhook(
  body: string,
  rawHeaders: Record<string, string | undefined>,
): Promise<NextResponse | null> {
  const webhookSecret = process.env.OVERAGE_WEBHOOK_SECRET?.trim();
  const cloudflareSecret = process.env.CLOUDFLARE_QUEUE_SECRET?.trim();
  const cloudflareSig = rawHeaders['X-Cloudflare-Signature'];

  if (cloudflareSig) {
    if (!cloudflareSecret) {
      return NextResponse.json({ error: 'Cloudflare queue secret not configured' }, { status: 503 });
    }
    const isValid = await verifyCloudflareSignature(body, cloudflareSig, cloudflareSecret);
    return isValid
      ? null
      : NextResponse.json({ error: 'Invalid Cloudflare signature' }, { status: 401 });
  }

  if (!webhookSecret) {
    return NextResponse.json({ error: 'No webhook secret configured' }, { status: 503 });
  }

  const isValid = await verifySignature(body, rawHeaders, webhookSecret);
  return isValid ? null : NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
}

function parseValidatedOverageEvent(body: string): OverageEvent | NextResponse {
  let event: unknown;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = overageEventSchema.safeParse(event);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid event format', details: parseResult.error.message },
      { status: 400 },
    );
  }
  return parseResult.data;
}

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get('Polar-Signature')) {
      return NextResponse.json(
        { error: 'Polar webhook signatures are prohibited on Sophia' },
        { status: 400 },
      );
    }

    const rawHeaders: Record<string, string | undefined> = {
      'webhook-id': request.headers.get('webhook-id') || undefined,
      'webhook-timestamp': request.headers.get('webhook-timestamp') || undefined,
      'webhook-signature': request.headers.get('webhook-signature') || undefined,
      'X-Cloudflare-Signature': request.headers.get('X-Cloudflare-Signature') || undefined,
    };

    const headerValidation = headerSchema.safeParse(rawHeaders);
    if (!headerValidation.success) {
      return NextResponse.json(
        { error: 'Invalid headers', details: headerValidation.error.message },
        { status: 400 },
      );
    }

    const body = await request.text();
    const authErr = await authenticateOverageWebhook(body, rawHeaders);
    if (authErr) return authErr;

    const validatedOrErr = parseValidatedOverageEvent(body);
    if (validatedOrErr instanceof NextResponse) return validatedOrErr;

    const webhookId = headerValidation.data['webhook-id'];
    const db = createServerClient();

    const claimState = await claimOverageWebhookIdempotency(
      webhookId,
      validatedOrErr.idempotencyKey,
      body,
      db,
    );
    if (claimState === 'duplicate_processed') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    if (claimState === 'in_progress') {
      return NextResponse.json({ error: 'Event already in progress' }, { status: 409 });
    }

    const result = await storeUsageEvent(validatedOrErr, db);
    if (!result.success) {
      await finalizeOverageWebhookIdempotency(webhookId, validatedOrErr.idempotencyKey, false);
      return NextResponse.json(
        { error: 'Failed to store event', details: result.error },
        { status: 500 },
      );
    }

    if (!result.duplicate) {
      await logOverageEvent(validatedOrErr, db);
    }
    await finalizeOverageWebhookIdempotency(webhookId, validatedOrErr.idempotencyKey, true);

    return NextResponse.json({
      received: true,
      processed: !result.duplicate,
      duplicate: Boolean(result.duplicate),
      eventId: validatedOrErr.idempotencyKey,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoints: {
      overage: '/api/webhooks/overage-billing',
    },
  });
}
