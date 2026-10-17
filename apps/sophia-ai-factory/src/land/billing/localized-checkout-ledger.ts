/**
 * Localized Checkout Ledger Persistence
 *
 * @module land/billing/localized-checkout-ledger
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  LocalizedPaymentIntentInput,
  LocalizedTransactionRecord,
} from '@/seed/types/localized-rails';
import type { dispatchLocalizedPaymentIntent } from '@/tree/rails/rail-dispatcher';

export interface LocalizedCheckoutError {
  code: string;
  message: string;
}

export type DispatchedIntentResult = Awaited<ReturnType<typeof dispatchLocalizedPaymentIntent>>;

export async function insertLocalizedPaymentLedgerRecords(
  db: D1Database,
  userId: string,
  input: LocalizedPaymentIntentInput,
  intentResult: DispatchedIntentResult,
): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAtSec = Math.floor(intentResult.expiresAt / 1000);
  const idempotencyKey = input.idempotencyKey ?? `idem_${intentResult.transactionId}`;

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
      userId,
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
      intentResult.totalAmount - intentResult.subtotalAmount,
      nowSec,
      nowSec,
    )
    .run();
}

export async function queryLocalizedTransactionById(
  db: D1Database,
  transactionId: string,
): Promise<LocalizedTransactionRecord | null> {
  return db
    .prepare(`SELECT * FROM localized_payment_transactions WHERE id = ?1 LIMIT 1`)
    .bind(transactionId)
    .first<LocalizedTransactionRecord>();
}
