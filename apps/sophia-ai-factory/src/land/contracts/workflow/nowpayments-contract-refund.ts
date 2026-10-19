import type { D1Database } from '@cloudflare/workers-types';
import type { EnterpriseContract } from '@/seed/types/enterprise-contracts';

export interface NowPaymentsContractRefundInput {
  contract: EnterpriseContract;
  invoiceId: string;
  orderId: string;
  paidByUserId: string;
  paymentId: string;
  providerInvoiceId: string;
  amountCents: number;
  lockCreatedAt: string;
  orderStatus: 'pending' | 'expired' | 'failed' | 'completed';
  wasCompleted: boolean;
}

/** Revoke a refunded contract invoice and reverse its MCU grant exactly once. */
export async function refundNowPaymentsContractOrder(
  db: D1Database,
  input: NowPaymentsContractRefundInput,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const eventId = `nowpayments_${input.paymentId}_refunded`;
  const refundReference = `${input.paymentId}_refund`;
  const lock = (eventParam: number, createdAtParam: number) =>
    `EXISTS (SELECT 1 FROM payment_events WHERE event_id = ?${eventParam} AND created_at = ?${createdAtParam} AND processed = 2)`;
  const expectedOrderStatus = input.orderStatus;
  const statements = [
    db.prepare(`UPDATE payment_events SET processed = 2
      WHERE event_id = ?1 AND created_at = ?2 AND processed = 0
      AND EXISTS (SELECT 1 FROM pending_orders WHERE order_id = ?3 AND user_id = ?4
        AND (provider_payment_id IS NULL OR provider_payment_id = ?5)
        AND (payment_id IS NULL OR payment_id = ?6) AND status = ?7
        AND payment_method = 'nowpayments' AND purpose = 'contract' AND contract_id = ?8
        AND invoice_id = ?9 AND amount_usd_cents = ?10)
      AND EXISTS (SELECT 1 FROM enterprise_contracts WHERE id = ?8 AND org_id = ?11
        AND ((last_invoice_id = ?9 AND status IN ('signed', 'active')) OR
          (last_invoice_id != ?9 AND status IN ('signed', 'active', 'terminated'))))
      AND EXISTS (SELECT 1 FROM invoices WHERE id = ?9 AND org_id = ?11
        AND currency = 'USD' AND total_amount_cents = ?10
        AND (?12 = 0 OR status = 'paid'))
      AND (?12 = 0 OR EXISTS (SELECT 1 FROM mcu_transactions
        WHERE payment_reference = ?6 AND user_id = ?4 AND delta = ?13))
      AND NOT EXISTS (SELECT 1 FROM mcu_transactions WHERE payment_reference = ?14)`)
      .bind(eventId, input.lockCreatedAt, input.orderId, input.paidByUserId,
        input.providerInvoiceId, input.paymentId, expectedOrderStatus,
        input.contract.id, input.invoiceId, input.amountCents, input.contract.orgId,
        input.wasCompleted ? 1 : 0, input.contract.mcuCapacityMonthly, refundReference),
    db.prepare(`UPDATE invoices SET status = 'refunded', updated_at = ?1
      WHERE id = ?2 AND org_id = ?3 AND ${input.wasCompleted ? "status = 'paid'" : "status != 'paid'"}
        AND ${lock(4, 5)}`)
      .bind(now, input.invoiceId, input.contract.orgId, eventId, input.lockCreatedAt),
    db.prepare(`UPDATE enterprise_contracts SET status = 'terminated', updated_at = ?1
      WHERE id = ?2 AND org_id = ?3 AND last_invoice_id = ?4 AND status IN ('signed', 'active')
        AND EXISTS (SELECT 1 FROM invoices WHERE id = ?4 AND status = 'refunded')
        AND ${lock(5, 6)}`)
      .bind(now, input.contract.id, input.contract.orgId, input.invoiceId, eventId, input.lockCreatedAt),
    db.prepare(`UPDATE pending_orders SET provider_payment_id = COALESCE(provider_payment_id, ?1),
        payment_id = COALESCE(payment_id, ?2), status = 'refunded'
      WHERE order_id = ?3 AND (provider_payment_id IS NULL OR provider_payment_id = ?1)
        AND (payment_id IS NULL OR payment_id = ?2) AND status = ?4
        AND purpose = 'contract' AND contract_id = ?5 AND invoice_id = ?6 AND ${lock(7, 8)}`)
      .bind(input.providerInvoiceId, input.paymentId, input.orderId, expectedOrderStatus,
        input.contract.id, input.invoiceId, eventId, input.lockCreatedAt),
  ];

  if (input.wasCompleted) {
    statements.push(db.prepare(`INSERT INTO mcu_transactions (user_id, delta, reason, metadata, payment_reference)
      SELECT ?1, -?2, 'ENTERPRISE_CONTRACT_REFUND', ?3, ?4
      WHERE ${lock(5, 6)} AND EXISTS (SELECT 1 FROM invoices WHERE id = ?7 AND status = 'refunded')
        AND EXISTS (SELECT 1 FROM pending_orders WHERE order_id = ?8 AND status = 'refunded')
      ON CONFLICT(payment_reference) DO NOTHING`)
      .bind(input.paidByUserId, input.contract.mcuCapacityMonthly,
        JSON.stringify({ contractId: input.contract.id, invoiceId: input.invoiceId,
          paymentRail: 'NOWPAYMENTS', paymentReference: input.paymentId, event: 'refund' }),
        refundReference, eventId, input.lockCreatedAt, input.invoiceId, input.orderId));
    statements.push(db.prepare(`UPDATE user_mcu_balance SET credits_remaining = credits_remaining - ?1,
        updated_at = ?2 WHERE user_id = ?3 AND changes() = 1`)
      .bind(input.contract.mcuCapacityMonthly, now, input.paidByUserId));
  }

  const finalEventStatement = input.wasCompleted
    ? db.prepare(`UPDATE payment_events SET processed = 1 WHERE event_id = ?1 AND created_at = ?2 AND processed = 2
        AND EXISTS (SELECT 1 FROM pending_orders WHERE order_id = ?3 AND status = 'refunded'
          AND payment_id = ?4 AND provider_payment_id = ?5)
        AND EXISTS (SELECT 1 FROM invoices WHERE id = ?6 AND status = 'refunded')
        AND EXISTS (SELECT 1 FROM enterprise_contracts WHERE id = ?7 AND org_id = ?11
          AND ((last_invoice_id = ?6 AND status = 'terminated') OR
            (last_invoice_id != ?6 AND status IN ('signed', 'active', 'terminated'))))
        AND EXISTS (SELECT 1 FROM mcu_transactions WHERE payment_reference = ?8 AND user_id = ?9 AND delta = -?10)
        AND EXISTS (SELECT 1 FROM user_mcu_balance WHERE user_id = ?9)`)
      .bind(eventId, input.lockCreatedAt, input.orderId, input.paymentId,
        input.providerInvoiceId, input.invoiceId, input.contract.id, refundReference,
        input.paidByUserId, input.contract.mcuCapacityMonthly, input.contract.orgId)
    : db.prepare(`UPDATE payment_events SET processed = 1 WHERE event_id = ?1 AND created_at = ?2 AND processed = 2
        AND EXISTS (SELECT 1 FROM pending_orders WHERE order_id = ?3 AND status = 'refunded'
          AND payment_id = ?4 AND provider_payment_id = ?5)
        AND EXISTS (SELECT 1 FROM invoices WHERE id = ?6 AND status = 'refunded')
        AND EXISTS (SELECT 1 FROM enterprise_contracts WHERE id = ?7 AND org_id = ?8
          AND ((last_invoice_id = ?6 AND status = 'terminated') OR
            (last_invoice_id != ?6 AND status IN ('signed', 'active', 'terminated'))))`)
      .bind(eventId, input.lockCreatedAt, input.orderId, input.paymentId,
        input.providerInvoiceId, input.invoiceId, input.contract.id, input.contract.orgId);
  statements.push(finalEventStatement);

  // Force D1.batch to roll back if any guarded transition or final invariant failed.
  statements.push(db.prepare(`INSERT INTO payment_events (event_id, processed, created_at)
    SELECT ?1, 0, ?2 WHERE NOT EXISTS (
      SELECT 1 FROM payment_events WHERE event_id = ?1 AND created_at = ?2 AND processed = 1)`)
    .bind(eventId, input.lockCreatedAt));

  const results = await db.batch(statements);
  const requiredTransitions = input.wasCompleted ? [0, 1, 3, 4, 5, 6] : [0, 1, 3, 4];
  if (results.some((result) => !result.success || result.error) ||
      requiredTransitions.some((index) => results[index]?.meta?.changes !== 1)) {
    throw new Error('NOWPayments contract refund failed its atomic invariants');
  }
}
