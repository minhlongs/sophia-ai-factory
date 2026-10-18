/**
 * Atomic lock management and stale lock recovery for NOWPayments IPN
 * @module land/billing/ipn-handlers/lock-manager
 */

import type { D1Client } from '@/seed/db/d1-client-rpc';
import { logger } from '@/seed/utils/logger-utility';
import { safeCatch } from '@/seed/utils/safe-catch';
import { detectStaleLock, type StaleLockDatabase } from '@/seed/utils/stale-lock-recovery';
import type { NowPaymentsIpnPayload } from './types';
import {
  acquireTerminalIpnLock,
  markTerminalIpnProcessed,
  releaseTerminalIpnLock,
  recordNowPaymentsRefundBarrier,
  hasNowPaymentsRefundBarrier,
} from './terminal-lock-manager';

export type IpnLockResult =
  | { status: 'acquired' }
  | { status: 'already_processed' }
  | { status: 'already_processing' }
  | { status: 'stale_recovered_retry' }
  | { status: 'stale_recovery_in_progress' }
  | { status: 'db_failure' };

export async function recoverStaleLock(
  db: D1Client,
  eventId: string,
  payment_id: string,
  payment_status: string,
): Promise<IpnLockResult> {
  const staleDetect = await detectStaleLock(db as unknown as StaleLockDatabase, eventId);
  if (!staleDetect.ok) {
    logger.error('[NOWPayments] Stale lock detection failed', staleDetect.error, { eventId, payment_id });
    return { status: 'db_failure' };
  }
  if (!staleDetect.value) {
    return { status: 'already_processing' };
  }

  const updateResult = await db
    .prepare('UPDATE payment_events SET processed = 2 WHERE event_id = ?1 AND processed = 0')
    .bind(eventId)
    .run<{ changes: number }>();

  if (updateResult.meta?.changes !== 1) {
    return { status: 'stale_recovery_in_progress' };
  }

  logger.error('[NOWPayments] Stale lock recovered — re-enqueuing for retry', {
    eventId, payment_id, payment_status,
  });
  try {
    await db
      .prepare('DELETE FROM payment_events WHERE event_id = ?1')
      .bind(eventId)
      .run<{ changes: number }>();
  } catch (e) { safeCatch('Stale lock delete')(e); }
  return { status: 'stale_recovered_retry' };
}

/**
 * Attempts to acquire an atomic lock for the IPN event using INSERT ... ON CONFLICT DO NOTHING.
 * Handles existing locks and stale lock recovery.
 */
export async function acquireIpnLock(
  db: D1Client,
  eventId: string,
  ipn: NowPaymentsIpnPayload,
  now: string,
): Promise<IpnLockResult> {
  const { payment_id, payment_status } = ipn;

  const lockResult = await db
    .prepare(
      `INSERT INTO payment_events (event_id, event_type, payload, processed, created_at)
       VALUES (?1, ?2, ?3, 0, ?4)
       ON CONFLICT(event_id) DO NOTHING`,
    )
    .bind(eventId, `nowpayments.${payment_status}`, JSON.stringify(ipn), now)
    .run();

  if (lockResult.meta?.changes) {
    return { status: 'acquired' };
  }

  const existing = await db
    .prepare('SELECT processed, created_at FROM payment_events WHERE event_id = ?1')
    .bind(eventId)
    .first<{ processed: number | boolean; created_at: string }>();

  if (!existing) {
    return { status: 'db_failure' };
  }

  if (existing.processed === 1) {
    return { status: 'already_processed' };
  }

  return recoverStaleLock(db, eventId, payment_id, payment_status);
}

export {
  acquireTerminalIpnLock,
  markTerminalIpnProcessed,
  releaseTerminalIpnLock,
  recordNowPaymentsRefundBarrier,
  hasNowPaymentsRefundBarrier,
};
