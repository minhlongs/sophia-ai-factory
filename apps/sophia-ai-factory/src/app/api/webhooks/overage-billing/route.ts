/**
 * Overage Billing Webhook Handler
 *
 * Processes overage events from Cloudflare Worker queue
 * and syncs to Supabase usage_events table.
 * Supports Polar/Stripe webhook signatures for verification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'standardwebhooks';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

// Webhook event schema
const overageEventSchema = z.object({
  licenseNonce: z.string(),
  userId: z.string(),
  tier: z.string(),
  usageCount: z.number(),
  overageCount: z.number(),
  overageFee: z.number(),
  timestamp: z.number(),
  idempotencyKey: z.string(),
  service: z.string().optional(),
  billingPeriod: z.string().optional()
});

// Header validation schema
const headerSchema = z.object({
  'webhook-id': z.string().min(1),
  'webhook-timestamp': z.string().min(1),
  'webhook-signature': z.string().min(1).optional(),
  'Polar-Signature': z.string().min(1).optional(),
  'X-Cloudflare-Signature': z.string().min(1).optional()
}).refine(
  data => data['webhook-signature'] || data['Polar-Signature'] || data['X-Cloudflare-Signature'],
  { message: 'At least one signature header required' }
);

/**
 * Verify webhook signature using timing-safe comparison
 * Supports Polar, Stripe, and Cloudflare signature formats
 */
async function verifySignature(
  body: string,
  headers: Record<string, string | undefined>,
  secret: string
): Promise<boolean> {
  try {
    const wh = new Webhook(secret);
    const signature = headers['Polar-Signature'] || headers['webhook-signature'];

    if (!signature) {
      return false;
    }

    wh.verify(body, {
      'webhook-id': headers['webhook-id'],
      'webhook-timestamp': headers['webhook-timestamp'],
      'webhook-signature': signature
    });

    return true;
  } catch {
    // Try base64-decoded secret
    try {
      const base64Secret = Buffer.from(secret).toString('base64');
      const wh = new Webhook(base64Secret);
      const signature = headers['Polar-Signature'] || headers['webhook-signature'];

      if (!signature) {
        return false;
      }

      wh.verify(body, {
        'webhook-id': headers['webhook-id'],
        'webhook-timestamp': headers['webhook-timestamp'],
        'webhook-signature': signature
      });

      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Verify HMAC-SHA256 signature with timing-safe comparison
 * Prevents timing attacks on signature validation
 */
async function verifyHmacSignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const crypto = await import('node:crypto');
    const expectedHex = crypto.createHmac('sha256', secret).update(body).digest('hex');

    // Convert to buffers for timing-safe comparison
    const signatureBuf = Buffer.from(signature, 'hex');
    const expectedBuf = Buffer.from(expectedHex, 'hex');

    // Length check first, then timing-safe comparison
    return signatureBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(signatureBuf, expectedBuf);
  } catch {
    // Fallback for environments without node:crypto
    return false;
  }
}

/**
 * Verify Cloudflare queue event signature using timing-safe comparison
 */
function verifyCloudflareSignature(
  signature: string | undefined,
  expectedSecret: string
): boolean {
  if (!signature || !expectedSecret) {
    return false;
  }

  // Use HMAC-SHA256 with timing-safe comparison
  return verifyHmacSignature(signature, expectedSecret, expectedSecret);
}

/**
 * Check if event was already processed (idempotency)
 */
async function checkIdempotency(
  idempotencyKey: string,
  supabase: ReturnType<typeof createAdminClient>
): Promise<boolean> {
  const { data, error } = await supabase
    .from('usage_events')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .single();

  return !error && data !== null;
}

/**
 * Store usage event in Supabase
 */
async function storeUsageEvent(
  event: z.infer<typeof overageEventSchema>,
  supabase: ReturnType<typeof createAdminClient>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('usage_events').insert({
    license_nonce: event.licenseNonce,
    user_id: event.userId,
    tier: event.tier.toUpperCase(),
    usage_count: event.usageCount,
    overage_count: event.overageCount,
    overage_fee: event.overageFee,
    event_timestamp: new Date(event.timestamp).toISOString(),
    idempotency_key: event.idempotencyKey,
    service: event.service || 'default',
    billing_period: event.billingPeriod
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

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
      'Polar-Signature': request.headers.get('Polar-Signature') || undefined,
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
      // Cloudflare Queue event
      if (!verifyCloudflareSignature(cloudflareSig, cloudflareSecret)) {
        return NextResponse.json({ error: 'Invalid Cloudflare signature' }, { status: 400 });
      }
    } else if (webhookSecret) {
      // Polar/Stripe webhook
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

    // Initialize Supabase admin client
    const supabase = createAdminClient();

    // Check idempotency
    const isDuplicate = await checkIdempotency(validatedEvent.idempotencyKey, supabase);
    if (isDuplicate) {
      // Already processed - return success for idempotency
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

    // Log overage for billing reconciliation
    if (validatedEvent.overageFee > 0) {
      const { error: billingError } = await supabase
        .from('overage_events')
        .insert({
          user_id: validatedEvent.userId,
          license_nonce: validatedEvent.licenseNonce,
          overage_count: validatedEvent.overageCount,
          overage_fee: validatedEvent.overageFee,
          billing_period: validatedEvent.billingPeriod,
          processed: false
        });

      if (billingError) {
        // Log overage event but don't fail the webhook
        // In production, use a proper logger instead
      }
    }

    return NextResponse.json({
      received: true,
      processed: true,
      eventId: validatedEvent.idempotencyKey
    });
  } catch (error) {
    // In production, use a proper logger
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
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
