/**
 * Refund processor types and error definitions
 * @module land/refunds/processor/types
 */

import type { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';

export interface RefundProcessInput {
  /** The refund_requests row id */
  refundRequestId: string;
  /** Admin user who approved and is executing the refund */
  reviewedByUserId: string;
  /** Blockchain transaction hash from NOWPayments refund */
  txHash: string;
  /** Optional admin notes */
  notes?: string;
}

export interface RefundProcessResult {
  refundRequestId: string;
  ledgerEntryId: string;
  tierBefore: string;
  tierAfter: string;
  mcuClawedBack: number;
  transactionHash: string;
}

export interface RefundError {
  code: 'DUPLICATE_REFUND' | 'NOT_FOUND' | 'NOWPAYMENTS_API_ERROR' | 'INTERNAL_ERROR';
  message: string;
}

export class RefundProcessError extends Error {
  constructor(
    public code: RefundError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'RefundProcessError';
  }
}

export interface SubscriptionRow {
  plan: string;
  status: string;
}

export const ACQUIRE_REFUND_LOCK_SQL = `INSERT INTO refund_events (event_id, refund_request_id, refund_type, payload, processed, created_at)
  VALUES (?1, ?2, 'manual', ?3, 0, ?4)
  ON CONFLICT(event_id) DO NOTHING`;

export const CHECK_REFUND_LOCK_SQL = `SELECT processed FROM refund_events WHERE event_id = ?1`;

export const DELETE_REFUND_LOCK_SQL = `DELETE FROM refund_events WHERE event_id = ?1`;

export const RELEASE_REFUND_LOCK_SQL = `UPDATE refund_events SET processed = 1, processed_at = ?1 WHERE event_id = ?2`;

export async function acquireRefundEventLock(
  db: NonNullable<Awaited<ReturnType<typeof getD1>>>,
  eventId: string,
  input: RefundProcessInput,
  now: string,
): Promise<Result<void, RefundError>> {
  const lockResult = await db
    .prepare(ACQUIRE_REFUND_LOCK_SQL)
    .bind(eventId, input.refundRequestId, JSON.stringify(input), now)
    .run();

  if (lockResult.meta?.changes) {
    return success(undefined);
  }

  const existing = await db
    .prepare(CHECK_REFUND_LOCK_SQL)
    .bind(eventId)
    .first<{ processed: number }>();

  if (!existing) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database query failure on lock check' });
  }
  if (existing.processed === 1) {
    return failure({ code: 'DUPLICATE_REFUND', message: 'Refund already processed' });
  }
  return failure({
    code: 'INTERNAL_ERROR',
    message: 'Refund is currently being processed by another request',
  });
}
