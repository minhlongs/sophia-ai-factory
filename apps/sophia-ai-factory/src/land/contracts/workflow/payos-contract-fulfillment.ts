import type { D1Database } from '@cloudflare/workers-types';
import type { EnterpriseContract } from '@/seed/types/enterprise-contracts';

export interface PayOsContractFulfillmentInput {
  contract: EnterpriseContract;
  invoiceId: string;
  orderId: string;
  paidByUserId: string;
  paymentReference: string;
  providerOrderCode: number;
  amountVnd: number;
  lockCreatedAt: string;
}

/** Atomically settle a correlated PayOS contract payment and MCU grant. */
export async function fulfillPayOsContractOrder(
  db: D1Database,
  input: PayOsContractFulfillmentInput,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const eventId = `payos_${input.paymentReference}`;
  const creditMetadata = JSON.stringify({
    contractId: input.contract.id,
    invoiceId: input.invoiceId,
    paymentRail: 'PAYOS',
    paymentReference: input.paymentReference,
  });
  const lock = (eventParam: number, createdAtParam: number) =>
    `EXISTS (SELECT 1 FROM payment_events WHERE event_id = ?${eventParam} AND created_at = ?${createdAtParam} AND processed = 2)`;

  const statements = [
    db.prepare(`UPDATE payment_events SET processed = 2
      WHERE event_id = ?1 AND created_at = ?2 AND processed = 0
      AND EXISTS (SELECT 1 FROM pending_orders WHERE order_id = ?3 AND user_id = ?4
        AND (provider_payment_id IS NULL OR provider_payment_id = ?5)
        AND provider_order_code = ?6 AND status = 'pending'
        AND payment_method = 'payos' AND purpose = 'contract' AND contract_id = ?7
        AND invoice_id = ?8 AND amount_vnd = ?9)
      AND EXISTS (SELECT 1 FROM enterprise_contracts WHERE id = ?7 AND org_id = ?10
        AND last_invoice_id = ?8 AND status IN ('signed', 'active'))
      AND EXISTS (SELECT 1 FROM invoices WHERE id = ?8 AND org_id = ?10
        AND currency = 'VND' AND total_amount_cents = ?9 AND status != 'paid')
      AND NOT EXISTS (SELECT 1 FROM mcu_transactions WHERE payment_reference = ?5)`)
      .bind(eventId, input.lockCreatedAt, input.orderId, input.paidByUserId,
        input.paymentReference, input.providerOrderCode, input.contract.id,
        input.invoiceId, input.amountVnd, input.contract.orgId),
    db.prepare(`UPDATE invoices SET status = 'paid', paid_at = ?1, updated_at = ?1
      WHERE id = ?2 AND org_id = ?3 AND status != 'paid' AND ${lock(4, 5)}`)
      .bind(now, input.invoiceId, input.contract.orgId, eventId, input.lockCreatedAt),
    db.prepare(`UPDATE enterprise_contracts SET status = 'active', payment_rail = 'PAYOS', updated_at = ?1
      WHERE id = ?2 AND org_id = ?3 AND last_invoice_id = ?4 AND status IN ('signed', 'active')
      AND EXISTS (SELECT 1 FROM invoices WHERE id = ?4 AND status = 'paid') AND ${lock(5, 6)}`)
      .bind(now, input.contract.id, input.contract.orgId, input.invoiceId, eventId, input.lockCreatedAt),
    db.prepare(`INSERT INTO mcu_transactions (user_id, delta, reason, metadata, payment_reference)
      SELECT ?1, ?2, 'ENTERPRISE_CONTRACT_ACTIVATION', ?3, ?4
      WHERE ${lock(5, 6)} AND EXISTS (SELECT 1 FROM invoices WHERE id = ?7 AND status = 'paid')
      ON CONFLICT(payment_reference) DO NOTHING`)
      .bind(input.paidByUserId, input.contract.mcuCapacityMonthly, creditMetadata,
        input.paymentReference, eventId, input.lockCreatedAt, input.invoiceId),
    db.prepare(`INSERT INTO user_mcu_balance (user_id, credits_remaining, credits_total_purchased, updated_at)
      SELECT ?1, ?2, ?2, ?3 WHERE changes() = 1
      ON CONFLICT(user_id) DO UPDATE SET
        credits_remaining = credits_remaining + excluded.credits_remaining,
        credits_total_purchased = credits_total_purchased + excluded.credits_total_purchased,
        updated_at = excluded.updated_at`)
      .bind(input.paidByUserId, input.contract.mcuCapacityMonthly, now),
    db.prepare(`UPDATE pending_orders SET provider_payment_id = COALESCE(provider_payment_id, ?1),
      status = 'completed', payment_id = ?1, completed_at = ?2
      WHERE order_id = ?3 AND (provider_payment_id IS NULL OR provider_payment_id = ?1) AND status = 'pending'
      AND purpose = 'contract' AND contract_id = ?4 AND invoice_id = ?5 AND ${lock(6, 7)}`)
      .bind(input.paymentReference, new Date().toISOString(), input.orderId,
        input.contract.id, input.invoiceId, eventId, input.lockCreatedAt),
    db.prepare(`UPDATE payment_events SET processed = 1 WHERE event_id = ?1 AND created_at = ?2
      AND processed = 2 AND EXISTS (SELECT 1 FROM pending_orders WHERE order_id = ?3 AND status = 'completed')
      AND EXISTS (SELECT 1 FROM mcu_transactions WHERE payment_reference = ?4)`)
      .bind(eventId, input.lockCreatedAt, input.orderId, input.paymentReference),
  ];

  if (input.contract.dealId) {
    statements.push(db.prepare(`UPDATE enterprise_deals SET deal_stage = 'closed_won', updated_at = ?1
      WHERE id = ?2 AND EXISTS (SELECT 1 FROM payment_events
        WHERE event_id = ?3 AND created_at = ?4 AND processed = 1)`)
      .bind(now, input.contract.dealId, eventId, input.lockCreatedAt));
  }

  // If any guarded write unexpectedly changed zero rows, force D1.batch's
  // transaction to roll back by colliding with the existing event primary key.
  const dealIsClosed = input.contract.dealId
    ? 'AND EXISTS (SELECT 1 FROM enterprise_deals WHERE id = ?10 AND deal_stage = \'closed_won\')'
    : '';
  statements.push(db.prepare(`INSERT INTO payment_events (event_id, processed, created_at)
    SELECT ?1, 0, ?2 WHERE NOT (
      EXISTS (SELECT 1 FROM payment_events WHERE event_id = ?1 AND processed = 1 AND created_at = ?2)
      AND EXISTS (SELECT 1 FROM pending_orders WHERE order_id = ?3 AND status = 'completed'
        AND provider_payment_id = ?4 AND contract_id = ?5 AND invoice_id = ?6)
      AND EXISTS (SELECT 1 FROM invoices WHERE id = ?6 AND status = 'paid'
        AND currency = 'VND' AND total_amount_cents = ?7)
      AND EXISTS (SELECT 1 FROM enterprise_contracts WHERE id = ?5 AND status = 'active'
        AND last_invoice_id = ?6)
      AND EXISTS (SELECT 1 FROM mcu_transactions WHERE payment_reference = ?4
        AND user_id = ?8 AND delta = ?9)
      AND EXISTS (SELECT 1 FROM user_mcu_balance WHERE user_id = ?8)
      ${dealIsClosed})`)
    .bind(eventId, input.lockCreatedAt, input.orderId, input.paymentReference,
      input.contract.id, input.invoiceId, input.amountVnd, input.paidByUserId,
      input.contract.mcuCapacityMonthly, ...(input.contract.dealId ? [input.contract.dealId] : [])));

  const results = await db.batch(statements);
  if (results.some((result) => !result.success || result.error)) {
    throw new Error('PayOS contract fulfillment transaction failed');
  }
  if (results[0]?.meta?.changes !== 1 || results[1]?.meta?.changes !== 1 ||
      results[2]?.meta?.changes !== 1 || results[3]?.meta?.changes !== 1 ||
      results[4]?.meta?.changes !== 1 || results[5]?.meta?.changes !== 1 ||
      results[6]?.meta?.changes !== 1) {
    throw new Error(`PayOS contract fulfillment did not complete every required transition: ${results.map((result) => result.meta?.changes ?? 0).join(',')}`);
  }
}
