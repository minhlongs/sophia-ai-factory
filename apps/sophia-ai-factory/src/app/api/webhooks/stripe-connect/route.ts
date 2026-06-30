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
import {
  deriveAccountStatus,
  verifyWebhookSignature,
  type StripeAccountStatus,
} from '@/land/payouts/stripe-connect';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';

const WEBHOOK_SECRET = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

interface IdempotencyResult {
  alreadyProcessed: boolean;
}

/** Insert event into stripe_connect_events; returns true if duplicate. */
async function checkIdempotency(
  db: D1Database,
  event: Stripe.Event,
): Promise<IdempotencyResult> {
  try {
    await db
      .prepare(
        `INSERT INTO stripe_connect_events (event_id, event_type, account_id)
         VALUES (?, ?, ?)`,
      )
      .bind(
        event.id,
        event.type,
        (event.data.object as { id?: string } | undefined)?.id ?? null,
      )
      .run();
    return { alreadyProcessed: false };
  } catch (err) {
    // UNIQUE constraint failure on event_id = duplicate webhook
    const msg = getErrorMessage(err);
    if (/UNIQUE|constraint/i.test(msg)) {
      return { alreadyProcessed: true };
    }
    throw err;
  }
}

async function markEventProcessed(db: D1Database, eventId: string, error?: string): Promise<void> {
  await db
    .prepare(
      `UPDATE stripe_connect_events SET processed = 1, error = ? WHERE event_id = ?`,
    )
    .bind(error ?? null, eventId)
    .run();
}

async function applyAccountUpdate(db: D1Database, account: Stripe.Account): Promise<void> {
  const { status, payoutEnabled } = deriveAccountStatus({
    accountId: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    requirementsDisabledReason: account.requirements?.disabled_reason ?? null,
  });

  await db
    .prepare(
      `UPDATE user_payout_settings
         SET stripe_account_status = ?,
             stripe_payout_enabled = ?,
             stripe_last_event_at = datetime('now')
       WHERE stripe_account_id = ?`,
    )
    .bind(status, payoutEnabled ? 1 : 0, account.id)
    .run();

  logger.info('[stripe-connect/webhook] account.updated applied', {
    accountId: account.id,
    status,
    payoutEnabled,
  });
}

async function applyDeauthorization(db: D1Database, accountId: string): Promise<void> {
  const status: StripeAccountStatus = 'rejected';
  await db
    .prepare(
      `UPDATE user_payout_settings
         SET stripe_account_status = ?,
             stripe_payout_enabled = 0,
             stripe_last_event_at = datetime('now')
       WHERE stripe_account_id = ?`,
    )
    .bind(status, accountId)
    .run();

  logger.info('[stripe-connect/webhook] account deauthorized', { accountId });
}

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

  const _db = getD1();
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
    await markEventProcessed(db, event.id, msg).catch((err) => {
      logger.warn('Failed to mark Stripe event processed after handler failure', {
        error: String(err),
        context: 'POST',
        eventId: event.id,
      });
    });
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }
}
