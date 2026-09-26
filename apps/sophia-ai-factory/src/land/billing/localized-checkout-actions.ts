/**
 * Localized Checkout Server Actions
 *
 * Provides Server Actions for:
 * 1. Creating localized payment intents across 10 currencies & 6 localized rails
 * 2. Generating QR code payloads (PromptPay, PayNow SGQR, VietQR)
 * 3. Checking transaction status and clearing payment escrows
 *
 * Layer: land (Public business layer — Server Actions)
 * Dependencies: @/seed/*, @/tree/* (NO @/forest imports)
 *
 * @module land/billing/localized-checkout-actions
 */

'use server';

import { getD1 } from '@/seed/db/client';
import type { D1Database } from '@cloudflare/workers-types';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  type LocalizedPaymentIntentInput,
  type LocalizedPaymentIntentResult,
  type LocalizedTransactionRecord,
} from '@/seed/types/localized-rails';
import { dispatchLocalizedPaymentIntent } from '@/tree/rails/rail-dispatcher';

export interface LocalizedCheckoutError {
  code: string;
  message: string;
}

/**
 * Creates a localized payment intent with real-time FX hedging (+1.5% buffer reserve)
 * and automated tax compliance (EU VAT MOSS, SG GST, VN TT78).
 */
export async function createLocalizedPaymentIntentAction(
  input: LocalizedPaymentIntentInput,
): Promise<Result<LocalizedPaymentIntentResult, LocalizedCheckoutError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'You must be signed in to initiate checkout' });
    }

    const db = getD1() as unknown as D1Database;
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database service is currently unreachable' });
    }

    // 1. Dispatch payment intent calculation and rail payload generation
    const intentResult = await dispatchLocalizedPaymentIntent(input);

    const nowSec = Math.floor(Date.now() / 1000);
    const expiresAtSec = Math.floor(intentResult.expiresAt / 1000);
    const idempotencyKey = input.idempotencyKey ?? `idem_${intentResult.transactionId}`;

    // 2. Insert into localized_payment_transactions ledger
    await db
      .prepare(
        `INSERT INTO localized_payment_transactions (
           id, org_id, user_id, tier, billing_cycle, payment_rail,
           base_currency, base_amount_cents, settlement_currency, settlement_amount,
           fx_rate_applied, tax_jurisdiction, tax_rate, tax_amount_cents,
           tax_identifier, subtotal_amount, total_amount, rail_transaction_reference,
           qr_payload, mandate_reference, status, idempotency_key, expires_at,
           created_at, updated_at
         ) VALUES (
           ?1, ?2, ?3, ?4, ?5, ?6,
           'USD', ?7, ?8, ?9,
           ?10, ?11, ?12, ?13,
           ?14, ?15, ?16, ?17,
           ?18, ?19, 'pending', ?20, ?21,
           ?22, ?23
         )`,
      )
      .bind(
        intentResult.transactionId,
        input.orgId,
        user.id,
        input.tier,
        input.billingCycle,
        input.rail,
        intentResult.baseAmountCents,
        intentResult.currency,
        intentResult.totalAmount,
        intentResult.hedgedRate,
        intentResult.taxJurisdiction,
        intentResult.taxRate,
        intentResult.taxAmountCents,
        input.taxId ?? null,
        intentResult.subtotalAmount,
        intentResult.totalAmount,
        intentResult.transactionId,
        intentResult.qrPayload ?? null,
        intentResult.mandateReference ?? null,
        idempotencyKey,
        expiresAtSec,
        nowSec,
        nowSec,
      )
      .run();

    // 3. Insert into fx_hedging_reserves escrow ledger
    await db
      .prepare(
        `INSERT INTO fx_hedging_reserves (
           id, transaction_id, base_currency, target_currency, base_amount_cents,
           market_rate_at_quote, hedged_rate_at_quote, buffer_percent,
           reserve_amount_cents, reserve_amount_target, reserve_status,
           created_at, updated_at
         ) VALUES (
           lower(hex(randomblob(16))), ?1, 'USD', ?2, ?3,
           ?4, ?5, 0.015,
           ?6, ?7, 'escrowed',
           ?8, ?9
         )`,
      )
      .bind(
        intentResult.transactionId,
        intentResult.currency,
        intentResult.baseAmountCents,
        intentResult.marketRate,
        intentResult.hedgedRate,
        intentResult.bufferReserveCents,
        (intentResult.totalAmount - intentResult.subtotalAmount),
        nowSec,
        nowSec,
      )
      .run();

    logger.info('[LocalizedCheckoutActions] Payment intent created', {
      transactionId: intentResult.transactionId,
      rail: intentResult.rail,
      currency: intentResult.currency,
      totalAmount: intentResult.totalAmount,
    });

    return success(intentResult);
  } catch (err) {
    const error = toError(err);
    logger.error('[LocalizedCheckoutActions] Checkout intent creation failed', error);
    return failure({ code: 'CHECKOUT_FAILED', message: error.message });
  }
}

/**
 * Retrieves transaction record and current payment status.
 */
export async function getLocalizedTransactionStatusAction(
  transactionId: string,
): Promise<Result<LocalizedTransactionRecord, LocalizedCheckoutError>> {
  try {
    const db = getD1() as unknown as D1Database;
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'Database service is currently unreachable' });
    }

    const row = await db
      .prepare(
        `SELECT * FROM localized_payment_transactions WHERE id = ?1 LIMIT 1`,
      )
      .bind(transactionId)
      .first<LocalizedTransactionRecord>();

    if (!row) {
      return failure({ code: 'NOT_FOUND', message: `Transaction not found: ${transactionId}` });
    }

    return success(row);
  } catch (err) {
    const error = toError(err);
    logger.error('[LocalizedCheckoutActions] Status query failed', error);
    return failure({ code: 'QUERY_FAILED', message: error.message });
  }
}
