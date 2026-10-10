/**
 * Creator Payout Dispatcher & VietQR Generator
 *
 * Layer: land/creator/withdrawals
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  WithdrawalRequest,
  WithdrawalStatus,
} from '@/seed/types/creator-marketplace';
import {
  buildVietQrPaymentUrl,
  getExchangeRateVnd,
} from '@/land/payouts/dual-rail-payout-engine';
import { mapWithdrawalRow, type WithdrawalDbRow } from './types';

/**
 * Generate instant VietQR payment info and QR link for domestic Vietnamese transfers.
 */
export function getVietQrPaymentInfo(
  request: WithdrawalRequest,
  customExchangeRate?: number,
): { qrUrl: string; amountVnd: number; amountUsd: number } | null {
  if (request.rail !== 'VIETQR' || !request.bankBin || !request.bankAccountNumber) {
    return null;
  }

  const rate = customExchangeRate && customExchangeRate > 0
    ? customExchangeRate
    : getExchangeRateVnd();

  const amountUsd = request.amountCents / 100;
  const amountVnd = Math.round(amountUsd * rate);
  const memo = `SOPHIA CREATOR ${request.id.slice(-8).toUpperCase()}`;
  const accountName = request.bankAccountName || 'CREATOR';

  const qrUrl = buildVietQrPaymentUrl(
    request.bankBin,
    request.bankAccountNumber,
    amountVnd,
    memo,
    accountName,
  );

  return {
    qrUrl,
    amountVnd,
    amountUsd,
  };
}

/**
 * List withdrawal history for a creator.
 */
export async function listCreatorWithdrawals(
  db: D1Database,
  creatorId: string,
  options?: { limit?: number; offset?: number },
): Promise<{ items: WithdrawalRequest[]; total: number }> {
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
  const offset = Math.max(options?.offset ?? 0, 0);

  let total = 0;
  try {
    const countRow = await db
      .prepare(`SELECT COUNT(*) as cnt FROM creator_withdrawal_requests WHERE creator_id = ?`)
      .bind(creatorId)
      .first<{ cnt?: number }>();
    total = countRow?.cnt ?? 0;
  } catch (err) {
    logger.warn('Failed to count creator withdrawals', { creatorId, error: String(err) });
  }

  try {
    const rows = await db
      .prepare(
        `SELECT * FROM creator_withdrawal_requests
         WHERE creator_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(creatorId, limit, offset)
      .all<WithdrawalDbRow>();

    const items = (rows.results ?? []).map(mapWithdrawalRow);
    return { items, total };
  } catch (err) {
    logger.error('Failed to list creator withdrawals', { creatorId, error: String(err) });
    return { items: [], total: 0 };
  }
}

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
      // Update creator profile total_paid_cents
      await db
        .prepare(
          `UPDATE creator_profiles
           SET total_paid_cents = total_paid_cents + ?, updated_at = ?
           WHERE id = ? OR user_id = ?`,
        )
        .bind(current.amount_cents, nowMs, current.creator_id, current.creator_id)
        .run();

      // Record in creator_earnings_ledger as royalty_payout
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
