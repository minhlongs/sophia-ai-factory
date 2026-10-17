export const runtime = 'nodejs';

/**
 * POST /api/webhooks/stripe-connect
 *
 * Stripe Connect webhook handler.
 * Verifies signature via STRIPE_CONNECT_WEBHOOK_SECRET, dedupes by event.id,
 * and processes:
 *   - account.updated → upsert stripe_account_status + stripe_payout_enabled
 *   - account.application.deauthorized → flip status='rejected', payout_enabled=0
 *
 * All other event types are accepted (200) but ignored — Stripe retries on non-2xx.
 *
 * No auth required — Stripe signature is the auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getD1 } from '@/seed/db/client';
import { verifyWebhookSignature } from '@/land/payouts/stripe-connect';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  applyAccountUpdate,
  applyDeauthorization,
  checkIdempotency,
  markEventProcessed,
} from './stripe-connect-webhook-handlers';

const WEBHOOK_SECRET = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    logger.error('[stripe-connect/webhook] STRIPE_CONNECT_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  const event = verifyWebhookSignature(rawBody, signature, WEBHOOK_SECRET);
  if (!event) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const _db = await getD1();
  if (!_db) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  const db = _db;

  const { alreadyProcessed } = await checkIdempotency(db, event);
  if (alreadyProcessed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'account.updated': {
        await applyAccountUpdate(db, event.data.object as Stripe.Account);
        break;
      }
      case 'account.application.deauthorized': {
        const accountId = (event.account ?? (event.data.object as { id?: string }).id) || '';
        if (accountId) await applyDeauthorization(db, accountId);
        break;
      }
      default:
        // Accept and ignore — Stripe retries on non-2xx.
        break;
    }

    await markEventProcessed(db, event.id);
    return NextResponse.json({ received: true });
  } catch (err) {
    const msg = getErrorMessage(err);
    logger.error('[stripe-connect/webhook] handler failed', undefined, {
      eventId: event.id,
      type: event.type,
      error: msg,
    });
    await markEventProcessed(db, event.id, msg).catch((markErr) => {
      logger.warn('Failed to mark Stripe event processed after handler failure', {
        error: String(markErr),
        context: 'POST',
        eventId: event.id,
      });
    });
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }
}
