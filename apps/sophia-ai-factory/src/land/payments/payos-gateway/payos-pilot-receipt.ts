import type { D1Database } from '@cloudflare/workers-types';
import { OPTION_A_PILOT_CONTRACT as PILOT } from '@/seed/config/tiers/option-a-pilot-contract';

const legacyProof = `SELECT 1 FROM payos_events e
  WHERE e.event_id=o.payment_id AND e.processed=1 AND e.status='PAID'
    AND e.order_code=CAST(o.provider_order_code AS TEXT) AND e.currency=?2 AND e.amount=?1`;

const webhookProof = `SELECT 1 FROM payment_events e
  WHERE e.event_id=o.payment_id AND e.processed=1 AND e.event_type='payos.payment_success'
    AND CASE WHEN json_valid(e.payload) THEN
      json_extract(e.payload,'$.data.code')='00'
      AND json_extract(e.payload,'$.data.amount')=?1
      AND json_extract(e.payload,'$.data.currency')=?2
      AND json_extract(e.payload,'$.data.orderCode')=o.provider_order_code
      AND 'payos_' || json_extract(e.payload,'$.data.paymentLinkId')=o.payment_id
      ELSE 0 END`;

/** PayOS fulfillment commits to its own event and MCU ledgers, not manual bank tables. */
export async function getCommittedPayOsPilotReceipt(
  db: D1Database,
  rail: 'ipn' | 'webhook',
  orderId: string,
  userId: string,
  paymentId: string,
) {
  const eventProof = rail === 'ipn' ? legacyProof : webhookProof;
  const row = await db.prepare(`SELECT ?1 AS amount_vnd FROM pending_orders o
    WHERE o.order_id=?3 AND o.user_id=?4 AND o.payment_id=?5
      AND o.status='completed' AND o.payment_method='payos' AND o.tier=?6 AND o.period=?7
      AND (o.purpose IS NULL OR o.purpose='subscription')
      AND COALESCE(o.amount_vnd,?1)=?1
      AND EXISTS (${eventProof})
      AND EXISTS (SELECT 1 FROM mcu_transactions m
        WHERE m.payment_reference='payos_order_' || o.order_id AND m.user_id=o.user_id
          AND m.reason='PAYOS_SUBSCRIPTION_ACTIVATION' AND m.delta=?8)`)
    .bind(PILOT.priceVnd, PILOT.currency, orderId, userId, paymentId, PILOT.tier, PILOT.period, PILOT.includedMcu)
    .first<{ amount_vnd: number }>();
  return row?.amount_vnd === PILOT.priceVnd
    ? { activationStatus: 'ACTIVE_14D' as const, amountVnd: row.amount_vnd }
    : null;
}
