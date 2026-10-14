/**
 * Creator Payout Dispatcher & VietQR Generator
 *
 * Layer: land/creator/withdrawals
 */

import { logger } from '@/seed/utils/logger-utility';
import type { WithdrawalStatus } from '@/seed/types/creator-marketplace';
import type { WithdrawalDbRow } from './types';
import {
  getVietQrPaymentInfo,
  listCreatorWithdrawals,
} from './payout-dispatcher-helpers';

export { getVietQrPaymentInfo, listCreatorWithdrawals };

/**
 * Process a withdrawal request (admin / automated completion or rejection).
 */
export async function processWithdrawalRequest(
  db: D1Database,
  withdrawalId: string,
  action: 'complete' | 'reject',
  notes?: string,
  txHash?: string,
  nowMs = Date.now(),
): Promise<{ success: boolean; error?: string }> {
  try {
    const current = await db
      .prepare(`SELECT * FROM creator_withdrawal_requests WHERE id = ? LIMIT 1`)
      .bind(withdrawalId)
      .first<WithdrawalDbRow>();

    if (!current) {
      return { success: false, error: 'WITHDRAWAL_NOT_FOUND' };
    }

    if (current.status !== 'pending' && current.status !== 'processing') {
      return { success: false, error: `INVALID_STATUS_TRANSITION: Current status is ${current.status}` };
    }

    const nextStatus: WithdrawalStatus = action === 'complete' ? 'completed' : 'rejected';

    await db
      .prepare(
        `UPDATE creator_withdrawal_requests
         SET status = ?, tx_hash = ?, admin_notes = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(nextStatus, txHash ?? current.tx_hash, notes ?? current.admin_notes, nowMs, withdrawalId)
      .run();

    if (action === 'complete') {
      await db
        .prepare(
          `UPDATE creator_profiles
           SET total_paid_cents = total_paid_cents + ?, updated_at = ?
           WHERE id = ? OR user_id = ?`,
        )
        .bind(current.amount_cents, nowMs, current.creator_id, current.creator_id)
        .run();

      try {
        const ledgerId = `led_payout_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}_${nowMs}`;
        await db
          .prepare(
            `INSERT INTO creator_earnings_ledger (
              id, creator_id, amount_cents, currency, event_type, source_type,
              reference_id, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            ledgerId,
            current.creator_id,
            -current.amount_cents,
            current.currency,
            'royalty_payout',
            'withdrawal_request',
            withdrawalId,
            'paid',
            nowMs,
          )
          .run();
      } catch (ledgerErr) {
        logger.warn('Failed to insert payout event in creator_earnings_ledger', {
          withdrawalId,
          error: String(ledgerErr),
        });
      }
    }

    logger.info('Creator withdrawal status transitioned', {
      withdrawalId,
      oldStatus: current.status,
      newStatus: nextStatus,
    });

    return { success: true };
  } catch (err) {
    logger.error('Failed to process creator withdrawal request', { withdrawalId, error: String(err) });
    return { success: false, error: err instanceof Error ? err.message : 'PROCESS_FAILED' };
  }
}
