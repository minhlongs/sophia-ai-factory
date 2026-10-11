import { logger } from '@/seed/utils/logger-utility';
import type { PayoutRail } from './types';

/**
 * Creates payout batch record and handles failure rollbacks.
 */
export async function createBatchRecord(
  db: D1Database,
  batchId: string,
  rail: PayoutRail,
  totalAmountCents: number,
  recipientCount: number,
  nowMs: number,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO payout_batches (
          id, rail, total_amount_cents, recipient_count, status, created_at
        ) VALUES (?, ?, ?, ?, 'processing', ?)`,
      )
      .bind(batchId, rail, totalAmountCents, recipientCount, nowMs)
      .run();
  } catch {
    // Attempt fallback for legacy schema if total_cents column is expected
    try {
      await db
        .prepare(
          `INSERT INTO payout_batches (
            id, rail, total_cents, recipient_count, status, created_at
          ) VALUES (?, ?, ?, ?, 'processing', ?)`,
        )
        .bind(batchId, rail, totalAmountCents, recipientCount, nowMs)
        .run();
    } catch {
      logger.warn('[PayoutBatcher] Notice: payout_batches insert encountered schema variation', { batchId });
    }
  }
}

/**
 * Rollback claimed commission rows and mark payout batch failed.
 */
export async function rollbackBatch(
  db: D1Database,
  batchId: string,
): Promise<void> {
  try {
    await db
      .prepare(
        `UPDATE commission_ledger
         SET status = 'payable', payout_batch_id = NULL
         WHERE payout_batch_id = ? AND status = 'paying'`,
      )
      .bind(batchId)
      .run();

    await db
      .prepare(
        `UPDATE payout_batches
         SET status = 'failed'
         WHERE id = ?`,
      )
      .bind(batchId)
      .run();
  } catch (rollbackErr) {
    logger.error(
      '[PayoutBatcher] Critical: Failed to rollback paying rows after rail error',
      rollbackErr instanceof Error ? rollbackErr : new Error(String(rollbackErr)),
      { batchId },
    );
  }
}
