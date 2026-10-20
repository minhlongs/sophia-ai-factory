/**
 * Shared persistence for dual-rail contract checkout initiation.
 *
 * Both rails write the same intent shape to `pending_orders` before calling their
 * provider, link the resulting invoice to the contract, and roll the intent back
 * to `failed` when the contract link cannot be made. Keeping that in one place is
 * what stops the two rails from drifting apart.
 *
 * @module land/contracts/workflow/contract-payment-intent-store
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';

export type PaymentRail = 'NOWPAYMENTS' | 'PAYOS';

export type ContractIntentInput = {
  orderId: string;
  userId: string;
  contractId: string;
  invoiceId: string;
  period: string;
  amountCents: number;
  amountVnd?: number;
  customerEmail?: string;
  providerOrderCode?: number;
};

export type ContractLinkInput = {
  contractId: string;
  invoiceId: string;
  rail: PaymentRail;
  now: number;
};

/**
 * Reject a second checkout while one is still pending for the same contract.
 * The caller supplies the message because the pre-flight check and the PayOS
 * insert-retry path report this state in different words.
 */
export async function assertNoPendingIntent(
  db: D1Database,
  contractId: string,
  message: string,
): Promise<void> {
  const pendingIntent = await db.prepare(`SELECT order_id FROM pending_orders
      WHERE contract_id = ?1 AND purpose = 'contract' AND status = 'pending' LIMIT 1`)
    .bind(contractId).first<{ order_id: string }>();
  if (pendingIntent) {
    throw new Error(message);
  }
}

/** Persist the checkout intent for the given rail. */
export async function persistContractIntent(
  db: D1Database,
  rail: PaymentRail,
  input: ContractIntentInput,
): Promise<void> {
  const statement = rail === 'PAYOS'
    ? db.prepare(`INSERT INTO pending_orders (
          order_id, user_id, tier, period, payment_method, amount_usd_cents, amount_vnd,
          customer_email, purpose, contract_id,
          invoice_id, provider_order_code, status
        ) VALUES (?1, ?2, 'ENTERPRISE', ?3, 'payos', ?4, ?5, ?6,
          'contract', ?7, ?8, ?9, 'pending')`)
      .bind(input.orderId, input.userId, input.period, input.amountCents,
        input.amountVnd ?? 0, input.customerEmail ?? null, input.contractId,
        input.invoiceId, input.providerOrderCode ?? 0)
    : db.prepare(`INSERT INTO pending_orders (
          order_id, user_id, tier, period, payment_method, amount_usd_cents,
          customer_email, purpose, contract_id, invoice_id, status
        ) VALUES (?1, ?2, 'ENTERPRISE', ?3, 'nowpayments', ?4, ?5,
          'contract', ?6, ?7, 'pending')`)
      .bind(input.orderId, input.userId, input.period, input.amountCents,
        input.customerEmail ?? null, input.contractId, input.invoiceId);

  const result = await statement.run();
  if (!result.success || result.meta?.changes !== 1) {
    throw new Error(rail === 'PAYOS'
      ? 'Could not persist a unique PayOS contract payment correlation after five attempts'
      : 'Could not persist NOWPayments contract payment correlation');
  }
}

/**
 * Record the issued invoice on the contract. A contract that changed status while
 * the provider link was being created cannot be paid against, so the intent is
 * released rather than left as a phantom pending checkout.
 */
export async function linkContractToInvoice(
  db: D1Database,
  input: ContractLinkInput,
  orderId: string,
): Promise<void> {
  const contractUpdate = await db.prepare(`UPDATE enterprise_contracts SET last_invoice_id = ?1, payment_rail = ?2,
      updated_at = ?3 WHERE id = ?4 AND status IN ('signed', 'active')`)
    .bind(input.invoiceId, input.rail, input.now, input.contractId)
    .run();
  if (!contractUpdate.success || contractUpdate.meta?.changes !== 1) {
    await markContractOrderFailed(db, orderId);
    throw new Error('Contract changed before payment checkout could be linked');
  }
}

/** Release a checkout intent so the contract can be retried cleanly. */
export async function markContractOrderFailed(db: D1Database, orderId: string): Promise<void> {
  await db.prepare("UPDATE pending_orders SET status = 'failed' WHERE order_id = ?1 AND status = 'pending'")
    .bind(orderId).run();
}

/**
 * Attach the provider's payment reference to the intent. A failed link is not
 * fatal: the signed webhook can still correlate by order code.
 *
 * The PayOS statement binds `provider_order_code`, a column that may be absent on
 * an un-migrated database, so its failure is caught; NOWPayments binds no such
 * column and its failure stays inline.
 */
export async function linkProviderToOrder(
  db: D1Database,
  rail: PaymentRail,
  orderId: string,
  providerPaymentId: string,
  invoiceUrl: string,
  providerOrderCode?: number,
): Promise<void> {
  if (rail === 'PAYOS') {
    try {
      const linked = await db.prepare(`UPDATE pending_orders
      SET provider_payment_id = ?1, invoice_url = ?2
      WHERE order_id = ?3 AND provider_order_code = ?4 AND status = 'pending'`)
        .bind(providerPaymentId, invoiceUrl, orderId, providerOrderCode ?? 0)
        .run();
      if (!linked.success || linked.meta?.changes !== 1) {
        logger.warn('[QuoteToCash] PayOS link ID will be reconciled from signed order code', { orderId, providerOrderCode });
      }
    } catch (error) {
      logger.warn('[QuoteToCash] PayOS link ID persistence failed; signed order code remains correlatable', {
        orderId, providerOrderCode, error: String(error),
      });
    }
    return
  }

  const linked = await db.prepare(`UPDATE pending_orders SET provider_payment_id = ?1,
        invoice_url = ?2 WHERE order_id = ?3 AND status = 'pending'`)
    .bind(providerPaymentId, invoiceUrl, orderId).run();
  if (!linked.success || linked.meta?.changes !== 1) {
    logger.warn('[QuoteToCash] NOWPayments invoice link will be reconciled from order ID', { orderId });
  }
}
