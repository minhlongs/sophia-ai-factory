import type { D1Database } from '@cloudflare/workers-types';
import type { EnterpriseContract } from '@/seed/types/enterprise-contracts';

export interface NowPaymentsContractFulfillmentInput {
  contract: EnterpriseContract;
  invoiceId: string;
  orderId: string;
  paidByUserId: string;
  paymentId: string;
  providerInvoiceId: string;
  amountCents: number;
  lockCreatedAt: string;
}

/** Atomically settle a correlated NOWPayments contract payment and MCU grant. */
export async function fulfillNowPaymentsContractOrder(
  db: D1Database,
  input: NowPaymentsContractFulfillmentInput,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const eventId = `nowpayments_${input.paymentId}_finished`;
  const metadata = JSON.stringify({ contractId: input.contract.id, invoiceId: input.invoiceId,
    paymentRail: 'NOWPAYMENTS', paymentReference: input.paymentId });
  const lock = (event: number, created: number) =>
    `EXISTS (SELECT 1 FROM payment_events WHERE event_id = ?${event} AND created_at = ?${created} AND processed = 2)`;
  const statements = [
    db.prepare(`UPDATE payment_events SET processed = 2 WHERE event_id = ?1 AND created_at = ?2 AND processed = 0
      AND EXISTS (SELECT 1 FROM pending_orders WHERE order_id = ?3 AND user_id = ?4
        AND (provider_payment_id IS NULL OR provider_payment_id = ?5)
        AND status IN ('pending', 'expired', 'failed') AND payment_method = 'nowpayments'
        AND purpose = 'contract' AND contract_id = ?6 AND invoice_id = ?7 AND amount_usd_cents = ?8)
      AND EXISTS (SELECT 1 FROM enterprise_contracts WHERE id = ?6 AND org_id = ?9
        AND last_invoice_id = ?7 AND status IN ('signed', 'active'))
      AND EXISTS (SELECT 1 FROM invoices WHERE id = ?7 AND org_id = ?9
        AND currency = 'USD' AND total_amount_cents = ?8 AND status != 'paid')
      AND NOT EXISTS (SELECT 1 FROM mcu_transactions WHERE payment_reference = ?10)`)
      .bind(eventId, input.lockCreatedAt, input.orderId, input.paidByUserId,
        input.providerInvoiceId, input.contract.id, input.invoiceId, input.amountCents,
        input.contract.orgId, input.paymentId),
    db.prepare(`UPDATE invoices SET status = 'paid', paid_at = ?1, updated_at = ?1
      WHERE id = ?2 AND org_id = ?3 AND status != 'paid' AND ${lock(4, 5)}`)
      .bind(now, input.invoiceId, input.contract.orgId, eventId, input.lockCreatedAt),
    db.prepare(`UPDATE enterprise_contracts SET status = 'active', payment_rail = 'NOWPAYMENTS', updated_at = ?1
      WHERE id = ?2 AND org_id = ?3 AND last_invoice_id = ?4 AND status IN ('signed', 'active')
      AND EXISTS (SELECT 1 FROM invoices WHERE id = ?4 AND status = 'paid') AND ${lock(5, 6)}`)
      .bind(now, input.contract.id, input.contract.orgId, input.invoiceId, eventId, input.lockCreatedAt),
    db.prepare(`INSERT INTO mcu_transactions (user_id, delta, reason, metadata, payment_reference)
      SELECT ?1, ?2, 'ENTERPRISE_CONTRACT_ACTIVATION', ?3, ?4 WHERE ${lock(5, 6)}
        AND EXISTS (SELECT 1 FROM invoices WHERE id = ?7 AND status = 'paid') ON CONFLICT(payment_reference) DO NOTHING`)
      .bind(input.paidByUserId, input.contract.mcuCapacityMonthly, metadata, input.paymentId,
        eventId, input.lockCreatedAt, input.invoiceId),
    db.prepare(`INSERT INTO user_mcu_balance (user_id, credits_remaining, credits_total_purchased, updated_at)
      SELECT ?1, ?2, ?2, ?3 WHERE changes() = 1 ON CONFLICT(user_id) DO UPDATE SET
        credits_remaining = credits_remaining + excluded.credits_remaining,
        credits_total_purchased = credits_total_purchased + excluded.credits_total_purchased, updated_at = excluded.updated_at`)
      .bind(input.paidByUserId, input.contract.mcuCapacityMonthly, now),
    db.prepare(`UPDATE pending_orders SET provider_payment_id = COALESCE(provider_payment_id, ?1),
      status = 'completed', payment_id = ?2, completed_at = ?3
      WHERE order_id = ?4 AND (provider_payment_id IS NULL OR provider_payment_id = ?1)
        AND status IN ('pending', 'expired', 'failed')
        AND purpose = 'contract' AND contract_id = ?5 AND invoice_id = ?6 AND ${lock(7, 8)}`)
      .bind(input.providerInvoiceId, input.paymentId, new Date().toISOString(), input.orderId,
        input.contract.id, input.invoiceId, eventId, input.lockCreatedAt),
    db.prepare(`UPDATE payment_events SET processed = 1 WHERE event_id = ?1 AND created_at = ?2 AND processed = 2
      AND EXISTS (SELECT 1 FROM pending_orders WHERE order_id = ?3 AND status = 'completed')
      AND EXISTS (SELECT 1 FROM mcu_transactions WHERE payment_reference = ?4)`)
      .bind(eventId, input.lockCreatedAt, input.orderId, input.paymentId),
  ];
  if (input.contract.dealId) statements.push(db.prepare(`UPDATE enterprise_deals SET deal_stage = 'closed_won', updated_at = ?1
    WHERE id = ?2 AND EXISTS (SELECT 1 FROM payment_events WHERE event_id = ?3 AND created_at = ?4 AND processed = 1)`)
    .bind(now, input.contract.dealId, eventId, input.lockCreatedAt));
  const dealGuard = input.contract.dealId
    ? `AND EXISTS (SELECT 1 FROM enterprise_deals WHERE id = ?10 AND deal_stage = 'closed_won')` : '';
  statements.push(db.prepare(`INSERT INTO payment_events (event_id, processed, created_at) SELECT ?1, 0, ?2
    WHERE NOT (EXISTS (SELECT 1 FROM payment_events WHERE event_id = ?1 AND processed = 1 AND created_at = ?2)
      AND EXISTS (SELECT 1 FROM pending_orders WHERE order_id = ?3 AND status = 'completed' AND payment_id = ?4
        AND provider_payment_id = ?5 AND contract_id = ?6 AND invoice_id = ?7)
      AND EXISTS (SELECT 1 FROM invoices WHERE id = ?7 AND status = 'paid' AND currency = 'USD' AND total_amount_cents = ?8)
      AND EXISTS (SELECT 1 FROM enterprise_contracts WHERE id = ?6 AND status = 'active' AND last_invoice_id = ?7)
      AND EXISTS (SELECT 1 FROM mcu_transactions WHERE payment_reference = ?4 AND user_id = ?9 AND delta = ?11)
      AND EXISTS (SELECT 1 FROM user_mcu_balance WHERE user_id = ?9) ${dealGuard})`)
    .bind(eventId, input.lockCreatedAt, input.orderId, input.paymentId, input.providerInvoiceId,
      input.contract.id, input.invoiceId, input.amountCents, input.paidByUserId,
      input.contract.dealId ?? null, input.contract.mcuCapacityMonthly));
  const results = await db.batch(statements);
  if (results.some((result) => !result.success || result.error) ||
      results.slice(0, 7).some((result) => result.meta?.changes !== 1)) {
    throw new Error('NOWPayments contract fulfillment transaction failed its atomic invariants');
  }
}
