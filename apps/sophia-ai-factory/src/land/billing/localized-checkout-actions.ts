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
import {
  insertLocalizedPaymentLedgerRecords,
  queryLocalizedTransactionById,
  type LocalizedCheckoutError,
} from './localized-checkout-ledger';

export type { LocalizedCheckoutError };

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

    const intentResult = await dispatchLocalizedPaymentIntent(input);

    await insertLocalizedPaymentLedgerRecords(db, user.id, input, intentResult);

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

    const row = await queryLocalizedTransactionById(db, transactionId);

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
