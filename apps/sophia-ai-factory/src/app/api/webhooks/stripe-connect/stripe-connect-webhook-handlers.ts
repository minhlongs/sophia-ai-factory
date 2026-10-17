/**
 * Stripe Connect webhook event DB handlers (idempotency + account state updates)
 */

import type Stripe from 'stripe';
import { deriveAccountStatus, type StripeAccountStatus } from '@/land/payouts/stripe-connect';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';

export interface IdempotencyResult {
  alreadyProcessed: boolean;
}

/** Insert event into stripe_connect_events; returns true if duplicate. */
export async function checkIdempotency(
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
    const msg = getErrorMessage(err);
    if (/UNIQUE|constraint/i.test(msg)) {
      return { alreadyProcessed: true };
    }
    throw err;
  }
}

export async function markEventProcessed(
  db: D1Database,
  eventId: string,
  error?: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE stripe_connect_events SET processed = 1, error = ? WHERE event_id = ?`,
    )
    .bind(error ?? null, eventId)
    .run();
}

export async function applyAccountUpdate(db: D1Database, account: Stripe.Account): Promise<void> {
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

export async function applyDeauthorization(db: D1Database, accountId: string): Promise<void> {
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
