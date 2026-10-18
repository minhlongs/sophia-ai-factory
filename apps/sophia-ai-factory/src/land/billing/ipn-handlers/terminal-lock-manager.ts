/**
 * Terminal state lock management and refund barriers for NOWPayments IPN
 * @module land/billing/ipn-handlers/terminal-lock-manager
 */

import type { D1Client } from '@/seed/db/d1-client-rpc';
import type { NowPaymentsIpnPayload } from './types';
import { acquireIpnLock, recoverStaleLock, type IpnLockResult } from './lock-manager';

/**
 * Serialize final NOWPayments states by payment ID. A refund may follow a
 * completed payment, but a late `finished` event must never follow a refund.
 */
export async function acquireTerminalIpnLock(
  db: D1Client,
  ipn: NowPaymentsIpnPayload,
  now: string,
): Promise<IpnLockResult> {
  const eventId = `nowpayments_terminal_${ipn.payment_id}`;
  const eventType = `nowpayments.terminal.${ipn.payment_status}`;
  const inserted = await db
    .prepare(
      `INSERT INTO payment_events (event_id, event_type, payload, processed, created_at)
       VALUES (?1, ?2, ?3, 0, ?4)
       ON CONFLICT(event_id) DO NOTHING`,
    )
    .bind(eventId, eventType, JSON.stringify(ipn), now)
    .run();

  if (inserted.meta?.changes) return { status: 'acquired' };

  const existing = await db
    .prepare('SELECT event_type, processed, created_at FROM payment_events WHERE event_id = ?1')
    .bind(eventId)
    .first<{ event_type?: string; processed: number | boolean; created_at: string }>();

  if (!existing) return { status: 'db_failure' };

  if (existing.event_type === 'nowpayments.terminal.refunded') {
    if (ipn.payment_status === 'finished' || existing.processed === 1) {
      return { status: 'already_processed' };
    }
    return recoverStaleLock(db, eventId, ipn.payment_id, ipn.payment_status);
  }

  if (
    ipn.payment_status === 'refunded' &&
    (existing.event_type === 'nowpayments.terminal.finished' || existing.event_type === undefined)
  ) {
    if (existing.processed === 1) {
      const rearmed = await db
        .prepare(
          `UPDATE payment_events
           SET event_type = ?1, payload = ?2, processed = 0, created_at = ?3
           WHERE event_id = ?4 AND event_type = ?5 AND processed = 1`,
        )
        .bind(eventType, JSON.stringify(ipn), now, eventId, 'nowpayments.terminal.finished')
        .run<{ changes: number }>();
      if (rearmed.meta?.changes === 1 || rearmed.meta === undefined) return { status: 'acquired' };
    }
  }

  return acquireIpnLock(db, eventId, ipn, now);
}

export async function markTerminalIpnProcessed(
  db: D1Client,
  ipn: NowPaymentsIpnPayload,
  terminalStatus: 'finished' | 'refunded' = ipn.payment_status as 'finished' | 'refunded',
): Promise<void> {
  const eventId = `nowpayments_terminal_${ipn.payment_id}`;
  await db
    .prepare(
      `UPDATE payment_events
       SET event_type = ?1, payload = ?2, processed = 1
       WHERE event_id = ?3`,
    )
    .bind(`nowpayments.terminal.${terminalStatus}`, JSON.stringify(ipn), eventId)
    .run<{ changes: number }>();
  await db
    .prepare('UPDATE payment_events SET processed = 1 WHERE event_id = ?1')
    .bind(eventId)
    .run();
}

export async function releaseTerminalIpnLock(
  db: D1Client,
  paymentId: string,
): Promise<void> {
  await db
    .prepare('DELETE FROM payment_events WHERE event_id = ?1 AND processed = 0')
    .bind(`nowpayments_terminal_${paymentId}`)
    .run();
}

export async function recordNowPaymentsRefundBarrier(
  db: D1Client,
  paymentId: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO nowpayments_refund_barriers (payment_id, created_at)
       VALUES (?1, ?2)
       ON CONFLICT(payment_id) DO NOTHING`,
    )
    .bind(paymentId, new Date().toISOString())
    .run();
}

export async function hasNowPaymentsRefundBarrier(
  db: D1Client,
  paymentId: string,
): Promise<boolean> {
  const row = await db
    .prepare('SELECT payment_id FROM nowpayments_refund_barriers WHERE payment_id = ?1 LIMIT 1')
    .bind(paymentId)
    .first<{ payment_id: string }>();
  return Boolean(row?.payment_id === paymentId);
}
